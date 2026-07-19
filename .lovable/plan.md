# Verificación de la Ronda 3 de auditoría

Revisé la migración vigente, el trigger CRM y el UI. **Los 5 bugs son reales**, confirmados en código:

## Evidencia

**BUG 13 — Demoras destruye conceptos facturados** ✅ Real
`supabase/migrations/20260703173538_*.sql` líneas 66–67:

```sql
DELETE FROM conceptos_costo WHERE embarque_id = ... AND origen = 'demoras_auto';
DELETE FROM conceptos_venta WHERE embarque_id = ... AND origen = 'demoras_auto';
```

Sin filtro por `estado_facturacion`/`estado_liquidacion`, sin `pg_advisory_xact_lock`, y `proveedor_facturas_conceptos.concepto_costo_id` (FK NO ACTION) hará **fallar el DELETE** si ya está empatado a CxP → el usuario queda bloqueado sin poder recalcular. Además `monto_por_dia` (sin columna moneda) se inserta hardcodeado como `'USD'`.

**BUG 14 — TC=1 en facturas USD** ✅ Real
`supabase/migrations/20260709180513_*.sql` línea 369: al crear el borrador USD hace `INSERT ... tipo_cambio ... VALUES (..., 1, ...)`. La guarda de `facturapi-emitir` sólo rechaza NULL o ≤0 → **timbra con TC=1.00**.

**BUG 15 — Re-cotizar sin bloqueo tras embarque** ✅ Real
`src/features/cotizacion/components/CotizacionDetalleSecciones.tsx:124`: el bloque `esAceptada &&` renderiza "Re-cotizar" sin consultar `tieneEmbarquesVinculados` (que sí filtra "Crear embarque" en la línea 114).

**BUG 16 — `aceptar_cotizacion_version` no valida estado** ✅ Real
`supabase/migrations/20260630172919_*.sql` líneas 130–156: el UPDATE fija `estado='Aceptada'` sin filtrar por estado actual. Vencida, Archivada o Borrador pasan directo.

**BUG 17 — CRM conserva `valor_real` viejo** ✅ Real
Mismo archivo, líneas 84–88: `SET valor_real = COALESCE(valor_real, NEW.subtotal)` — al re-aceptar tras re-cotizar, el COALESCE preserva el valor de la primera aceptación.

**Menores confirmados:** revalidación honor-system (no hay trigger que dispare `solicitar_reaprobacion_tarifa`), y `operador` en la matriz de `agente_aprobar_tarifa`.

## ¿Necesitan corregirse?

Sí. BUG 13 y BUG 14 son **prioridad alta**: uno rompe integridad financiera (líneas facturadas desaparecen o CxP no permite recalcular), el otro sale al SAT con CFDI subvaluado. BUG 15–17 son sanidad de datos (forecast, ciclo de cotización). Los menores pueden diferirse.

## Plan de remediación (Ronda 3)

### Fase H — Demoras seguras (`v13.301.79`) — BUG 13

1. Nueva versión de `calcular_demoras_embarque(uuid)`:
  - `pg_advisory_xact_lock(hashtext(p_embarque_id::text))` al inicio.
  - Antes del recálculo, listar conceptos `demoras_auto` con: (a) `estado_facturacion IN ('en_proforma','facturado')` en `conceptos_venta`, o (b) match en `proveedor_facturas_conceptos` para `conceptos_costo`. Si existen → **RAISE `LC_DEMORAS_BLOQUEADAS**` con detalle jsonb (`conceptos_bloqueados`, `contenedores`).
  - Sólo hacer `DELETE` (soft: `deleted_at = now()`) de los realmente libres, luego insertar los nuevos.
  - Costo: leer la moneda desde `costeo_navieras_condiciones.moneda` (o columna equivalente) en vez de hardcodear `'USD'`.
2. Hook `useRecalcularDemoras` (`src/features/embarques/hooks/useDemorasEmbarque.ts`): mapear `LC_DEMORAS_BLOQUEADAS` a toast dedicado con lista de contenedores/conceptos afectados.
3. Guardrail `src/lib/__tests__/demoras-recalculo-seguro-fase-h.test.ts` — 6 asserts: advisory lock, RAISE con código, filtro por estado, sin hardcode `'USD'`, soft-delete, sin DELETE crudo sin filtro.

### Fase I — TC obligatorio en moneda extranjera (`v13.301.80`) — BUG 14

1. Migración: en `convertir_proformas_a_factura`, para el bloque USD (líneas 359–378) reemplazar `1` por `NULL` en `tipo_cambio` (igual que el flujo manual `marcarProformaFacturada`).
2. En `facturapi-emitir`: fortalecer `tipo_cambio_requerido` para rechazar TC = 1 exacto cuando `moneda <> 'MXN'` (no sólo NULL/≤0).
3. Guardrail `src/lib/__tests__/tipo-cambio-conversion-fase-i.test.ts` — 3 asserts: NULL en USD, guarda TC=1, MXN sigue con 1.

### Fase J — Ciclo de cotización correcto (`v13.301.81`) — BUG 15, 16, 17

1. UI: agregar `!tieneEmbarquesVinculados` a la condición de "Re-cotizar" en `CotizacionDetalleSecciones.tsx:124`. Mostrar tooltip "Ya hay un embarque; cree una nueva cotización".
2. Migración: `aceptar_cotizacion_version` — validar `IF v_estado_actual NOT IN ('Borrador','Enviada') THEN RAISE 'LC_COTIZACION_ESTADO_INVALIDO'`. Estados permitidos configurables por matriz.
3. Migración: `crm_set_valor_real_on_aceptada` — reemplazar `COALESCE(valor_real, NEW.subtotal)` por `NEW.subtotal` incondicional, e igual para `fecha_cierre_real = CURRENT_DATE`. Añadir bitácora del cambio.
4. Guardrail `src/lib/__tests__/cotizacion-ciclo-fase-j.test.ts` — 5 asserts.

### Fase K (opcional, menores) — Trigger de revalidación + matriz de aprobaciones

- Diferida hasta que confirmes; requiere definir política de "tarifa cambió tras aceptación".

## Estado acumulado tras aplicar


| Ronda | Fases | Versiones    |
| ----- | ----- | ------------ |
| 1     | A–C   | 13.301.69–72 |
| 2     | D–G   | 13.301.73–78 |
| 3     | H–J   | 13.301.79–81 |


## Detalles técnicos

- `pg_advisory_xact_lock` se libera al COMMIT/ROLLBACK; ideal para RPC transaccional.
- `estado_facturacion` de `conceptos_venta` ya se usa en Fase C (`eliminar_factura_borrador`), reutilizamos la misma nomenclatura.
- El check de CxP se hace con `EXISTS (SELECT 1 FROM proveedor_facturas_conceptos pfc WHERE pfc.concepto_costo_id = c.id)`.
- La guarda `TC=1` en `facturapi-emitir` va en `helpers.ts` junto a la validación existente.
- Al cambiar `crm_set_valor_real_on_aceptada` a `NEW.subtotal` incondicional, revisar tests existentes en `src/lib/__tests__/` para actualizar expectativas.

## Riesgos y qué podría romper

- **Fase H**: usuarios con demoras ya en proforma verán error al recalcular. Es el comportamiento correcto; documentar en toast que deben cancelar la proforma primero.
- **Fase I** `TC=NULL`: el flujo de timbrado exige capturarlo antes; ya hay UI para eso (`buildChecksTimbrado` — el check ya existe desde v13.171.0).
- **Fase J** `valor_real` incondicional: forecast se actualiza retroactivamente en re-aceptaciones. Es el comportamiento deseado según el hallazgo del audit.

¿Aprueba H → I → J en ese orden, o quiere reordenar prioridades / meter también las menores en la Fase K? Mete todo desde H a K