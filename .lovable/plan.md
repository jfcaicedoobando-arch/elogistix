# Cancelar con sustitución: impacto real en Proforma y Embarque

## Diagnóstico (qué pasa hoy)

Analogía: la factura, la proforma y el embarque son tres cuadernos que deberían leerse entre sí. Cuando cancelamos con sustitución, sólo escribimos en el cuaderno de **facturas**. Los otros dos se quedan con datos viejos.

### 1. Proforma origen (`facturas.proforma_id`)
- Al crear la sustituta, la RPC `duplicar_factura_para_sustitucion` **sí hereda** `proforma_id` y `embarque_id` al nuevo borrador y a sus conceptos. ✅
- Al aceptarse la cancelación motivo 01, el edge function `facturapi-cancelar` **omite explícitamente** la reversión de proformas (`terminales.ts:108`: `ctx.esSustitucion ? [] : await revertirProformasCancelacion(...)`).
- Y aunque no la omitiera, `revertirProformasCancelacion` busca por columnas legacy `proformas.factura_id` / `factura_secundaria_id` que el flujo moderno FacturAPI **nunca llena** → es código muerto para este camino.
- **Resultado real (PRO-2026-0973):** `estado_proforma='facturada'` para siempre, aunque su factura viva (F988) también fue cancelada. La proforma nunca se libera para re-facturar.

### 2. Embarque origen (`facturas.embarque_id`)
- No existe **ninguna** columna en `embarques` que refleje "facturado / cancelado / sustituido". Ni triggers, ni RPCs.
- La tabla puente `factura_embarques` se llena **sólo** en `convertir_proformas_a_factura`. Ni `duplicar_factura_para_sustitucion` ni `facturapi-emitir` insertan ahí → la sustituta F988 nunca quedó registrada en el puente.
- **Resultado real (ELIMP00294):** el embarque no percibe que su factura fue cancelada dos veces; los reportes que dependan de `factura_embarques` subestiman el estado.

### 3. Estado inconsistente adicional en F975
- F975 quedó `estado='Emitida'` con `cancellation_status='none'`, aunque fiscalmente ya está cancelada en el SAT (F988 la sustituyó con relación 04). El `handleAceptada` no completó localmente. Es un caso huérfano que hoy sólo se puede corregir con el botón manual "Limpiar estado local".

## Qué proponemos construir

### A. Backend — RPC `revertir_proforma_al_cancelar_sustitucion`
Nueva función `SECURITY DEFINER` que, dada una `factura_id` que pasa a `Cancelada`/`Sustituida`:
1. Encuentra la proforma vía `facturas.proforma_id` (flujo moderno).
2. Verifica si existe **otra factura viva** (`estado='Emitida'`, `sustituida_por IS NULL`) apuntando a esa misma proforma. Si sí → no hacer nada (la sustituta viva la sigue cubriendo).
3. Si no queda ninguna factura viva → `UPDATE proformas SET estado_proforma='pendiente', fecha_facturacion=NULL WHERE id=<proforma_id>`.
4. Registrar la acción en `bitacora_actividad`.

### B. Backend — Integrar la RPC en el flujo
- En `facturapi-cancelar/terminales.ts` (`handleAceptada`): quitar la exclusión `ctx.esSustitucion`. Ejecutar `revertir_proforma_al_cancelar_sustitucion` **tanto para motivo 01 como 02**. La lógica interna (paso 2) evita liberar la proforma si su sustituta sigue viva — cubre el caso "cancelo la original porque va a haber sustituta viva F988" (no libera) y "sustituta F988 también se cancela" (sí libera).
- Backfill único vía migración de datos: correr la RPC para todas las facturas actualmente `Cancelada`/`Sustituida` (incluye PRO-2026-0973 → volverá a `pendiente`).

### C. Backend — Sincronizar `factura_embarques`
- Extender `duplicar_factura_para_sustitucion`: al insertar la nueva factura, copiar las filas de `factura_embarques` de la original al nuevo id.
- En `facturapi-cancelar/terminales.ts`: al marcar una factura como `Cancelada`/`Sustituida`, **no** borrar filas de `factura_embarques` (mantiene trazabilidad histórica), pero agregar columna `activa boolean default true` a `factura_embarques` y ponerla en `false` cuando la factura ya no está vigente. Los reportes que quieran "facturas vivas del embarque" filtran por `activa=true`.

### D. UI — Banner ampliado en detalle de factura
- Cuando el detalle detecte `sustituida_por_ref?.estado === 'Cancelada'` **y** la proforma esté nuevamente `pendiente`, mostrar en el banner existente `SustitutaCanceladaBanner` un CTA "Re-facturar proforma" que navegue a la proforma.
- En el detalle de proforma: si `estado_proforma='pendiente'` pero existen facturas históricas en `facturas.proforma_id`, mostrar una nota "Esta proforma se facturó previamente (F975 → F988, ambas canceladas). Puedes emitir una nueva factura."

### E. Housekeeping
- Bump `APP_VERSION` a `13.301.31` y entrada en `CHANGELOG.md`.
- Tests: unit test para la RPC (proforma con sustituta viva → no libera; sin sustituta viva → libera), y assertion de `factura_embarques.activa` en el flujo de cancelación.

## Fuera de alcance (a decidir después)
- No agrego columna `estado_facturacion` en `embarques`; la información se deriva vía `factura_embarques.activa`. Si más adelante quieren un flag denormalizado para performance, se hace en otra iteración.
- No toco el flujo legacy `marcarProformaFacturada` — sigue funcionando para las facturas históricas creadas antes de FacturAPI.

## Detalles técnicos

Tablas afectadas:
- `proformas`: sin cambio de esquema, sólo escritura vía RPC.
- `facturas`: sin cambio.
- `factura_embarques`: +1 columna `activa boolean default true not null`.
- `bitacora_actividad`: +N filas por cada reversión.

Migraciones nuevas:
1. `add_activa_a_factura_embarques.sql`
2. `crear_revertir_proforma_al_cancelar_sustitucion.sql`
3. `backfill_reversion_proformas_facturas_canceladas.sql`
4. Update de `duplicar_factura_para_sustitucion` para copiar `factura_embarques`.

Edge functions:
- `supabase/functions/facturapi-cancelar/terminales.ts` — quitar exclusión de sustitución + invocar nueva RPC + marcar `activa=false`.

Frontend:
- `src/features/facturacion/components/detalle/SustitutaCanceladaBanner.tsx` — añadir CTA "Re-facturar proforma".
- `src/features/proformas/routes/ProformaDetalle.tsx` (o equivalente) — nota informativa cuando hay historial de facturas.

## Riesgos
- La reversión debe ser idempotente: si la corren dos veces, no debe romper nada. La RPC verifica el estado actual antes de escribir.
- El backfill masivo cambia el estado de proformas antiguas. Debemos correrlo dentro de la misma migración con `RAISE NOTICE` de cuántas filas se ven afectadas para revisar antes de aprobar.
