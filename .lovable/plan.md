# Auditoría — Tabla "Embarques sin factura" (Hueco de Facturación)

Ruta: `/facturacion?bandeja=embarques-sin-factura`
Servicio: `src/features/facturacion/services/huecoFacturacion/`
Bandeja: `BandejaPorFacturar.tsx` · Hook: `useHuecoFacturacion.ts`

## Cómo funciona hoy (regla actual)

Un embarque aparece en la tabla si cumple TODO lo siguiente:

1. `eta` capturado y `eta ≥ 2026-04-01` (corte del modelo nuevo).
2. `eta ≤ hoy + 3 días` naturales (buffer para el agente aduanal).
3. `embarques.facturado_historico = false`.
4. **Ningún registro** en `facturas` con el mismo `expediente` **y** `factura_pdf_url IS NOT NULL` (misma organización).
5. **NO** todos sus `conceptos_venta` no borrados están cubiertos por una `proforma` con `estado_proforma = 'facturada'` (exclusión por aceptación histórica del back-fill).

Se ordena por `diasDesdeEta desc`. Totales en MXN/USD se calculan sumando `conceptos_venta` con `tipo_cambio_usd/eur` del embarque.

## Hallazgos

### 🔴 Crítico

**H1. La detección de "ya facturado" ignora el estado real del CFDI.**
El filtro sólo mira `factura_pdf_url IS NOT NULL`. Consecuencia: si el único CFDI del expediente está **cancelado y sin sustituta viva**, el embarque se oculta del hueco aunque legalmente le falte una factura. Caso real observado: `ELIMP00263` tiene F971 `Cancelada/accepted` + F981 `Emitida` (bien), pero el patrón sería igual de silencioso con sólo la F971 cancelada y PDF viejo.

**H2. La correspondencia embarque→factura se hace por string `expediente`, no por el bridge `factura_embarques.activa`.**
Desde v13.301.31 existe `factura_embarques.activa` como fuente de verdad para "factura viva vinculada". El hueco no la usa y por tanto discrepa con el badge de la ficha del embarque. Observado: `ELIMP00263` está oculto del hueco (por match de expediente) pero `factura_embarques.activa = 0` → dos vistas del sistema contradicen.

**H3. Borradores con PDF cargado excluirían al embarque.**
El filtro `factura_pdf_url IS NOT NULL` no excluye borradores. Hoy típicamente los borradores no tienen PDF, pero cualquier flujo que precargue PDF de vista previa rompería el criterio silenciosamente.

### 🟠 Alto

**H4. No filtra por `modo` / `tipo`.**
Aparecen aéreas y otras modalidades sin discriminar. Ejemplo: `DEMO-2026-003 (Aéreo)` en el listado. Falta acuerdo de negocio: ¿la bandeja aplica a todos los modos/tipos, o sólo a Marítimo Importación como el resto del pipeline automático?

**H5. `calcularExclusionesPorProformaHistorica` no revalida el CFDI de la proforma.**
Excluye si TODOS los `conceptos_venta` están en una proforma con `estado_proforma='facturada'`, sin comprobar si la factura resultante fue cancelada sin sustituta viva. Un embarque cuya proforma "facturada" acabó cancelada seguirá oculto.

**H6. Aceptación histórica exige cobertura del 100 %.**
Si el operador añade un concepto adicional después de emitir la factura, la exclusión histórica ya no aplica y el embarque reaparece "como si no tuviera factura". Puede ser correcto o falso positivo según el negocio.

### 🟡 Medio

**H7. Divergencia horaria.** `diasDesde(fechaIso, hoy)` usa medianoche local; el resto del cálculo de estados (`calcularEstadoEmbarque`) trabaja en UTC. Cerca del cambio de día produce off-by-one entre el badge del embarque y la columna "días".

**H8. Umbral `hoy + 3 días` está hardcodeado en dos archivos** (`index.ts`, `fetchSources.ts` a través del argumento). No hay constante compartida ni configuración; el test lo valida con literal.

**H9. `sumarConceptosEnMxn/Usd` usa `tipo_cambio_usd/eur` del embarque, no del CFDI ni el vigente.**
Puede diferir de los totales que verá el usuario al abrir la factura después, generando percepción de inconsistencia.

**H10. El listado se limita a un solo hilo de query sin paginar** (usa `useClientPagedList` sobre el resultado completo). Aceptable hoy pero degrada con >2 000 embarques activos.

### 🟢 Menores (código)

- **H11.** El comentario de cabecera del servicio dice "v13.213.3" pero la lógica ya es la v13.217.0 — mantener sincronizado.
- **H12.** `buildFilas.ts` acepta un `expediente` vacío y lo persiste como `""` — en la UI podría confundirse con "no capturado".
- **H13.** El hook no invalida ante mutaciones de facturas (`timbrar`, `cancelar`, `sustituir`); depende del `staleTime: 60_000`. Cerrar/abrir la bandeja tras timbrar refresca por remount, pero volver desde el detalle en la misma sesión puede mostrar datos rancios hasta 1 min.

## Casos concretos observados (organización Libre Carga)


| Expediente    | Estados CFDI                           | fe_activas | ¿En hueco hoy? | ¿Debería?                                      |
| ------------- | -------------------------------------- | ---------- | -------------- | ---------------------------------------------- |
| ELIMP00263    | F971 Cancelada/accepted + F981 Emitida | 0          | No             | **Sí, si aceptamos H2** — no hay bridge activo |
| ELIMP00280    | F1 Cancelada + F955 Emitida            | 1          | No             | No — hay factura viva bridgeada                |
| ELIMP20268    | Borrador (sin PDF)                     | 1          | Sí             | Sí — borrador no cuenta como CFDI              |
| DEMO-2026-003 | Sin factura, modo Aéreo                | 0          | Sí             | Depende de H4 (regla de modo/tipo)             |


## Propuesta de corrección (a validar antes de implementar)

**Fase A — Fuente de verdad única (H1, H2, H3)**

- Reemplazar el join por `expediente` + `factura_pdf_url` por consulta a `factura_embarques` con `activa = true` uniéndose a `facturas` filtradas por `estado = 'Emitida'` (y `cancellation_status IS NULL`).
- Mantener el match por `expediente` sólo como fallback para facturas legacy sin bridge (registro en `app_logs` cuando ocurra, para migrar datos).

**Fase B — Alcance de negocio (H4)**

- Preguntar si la bandeja debe restringirse a `modo='Marítimo' AND tipo='Importación'` o dejar universal con filtros visibles en la UI.

**Fase C — Exclusión histórica robusta (H5, H6)**

- Al calcular exclusión por proforma histórica, verificar además que la factura ligada (`proforma_id → facturas`) esté viva (`estado='Emitida'`).
- Definir política cuando se añaden conceptos post-facturación: ¿genera un nuevo hueco automáticamente o requiere nota complementaria?

**Fase D — Consistencia técnica (H7–H13)**

- Normalizar `diasDesde` a UTC como `calcularEstadoEmbarque`.
- Extraer `HUECO_BUFFER_DIAS = 3` a `src/constants`.
- Invalidar `queryKeys.facturacion.hueco` desde las mutaciones de timbrar/cancelar/sustituir.
- Actualizar comentarios de versión y snapshot de tests.
- Considerar índice `facturas(organization_id, expediente) WHERE factura_pdf_url IS NOT NULL` si medimos latencia > 300 ms.

## Detalles técnicos (para revisión)

Archivos involucrados:

- `src/features/facturacion/services/huecoFacturacion/{index,fetchSources,buildFilas}.ts`
- `src/features/facturacion/services/shared/fetchFacturas.ts`
- `src/features/facturacion/hooks/useHuecoFacturacion.ts`
- `src/features/facturacion/components/bandejas/BandejaPorFacturar.tsx`
- Tests: `services/__tests__/huecoFacturacion.test.ts`, `domain/__tests__/huecoCsv.test.ts`

Tablas: `embarques`, `facturas`, `factura_embarques (activa)`, `conceptos_venta`, `proformas (estado_proforma)`.

## Preguntas para ti antes de codificar

1. **H4 (alcance).** ¿Restringimos la bandeja a Marítimo/Importación o la dejamos universal? Universal
2. **H1/H2 (fuente de verdad).** ¿Migramos ya a `factura_embarques.activa` como criterio principal, con fallback por expediente para datos legacy? Si
3. **H6 (conceptos post-facturación).** Cuando se añaden conceptos después de una proforma "facturada", ¿el embarque debe reaparecer en el hueco? Si
4. **Prioridad.** ¿Ataco todo (A→D) en un solo paso o vamos por fases con QA visual entre cada una? Vamos por fases

Este plan es sólo la auditoría. La corrección se agenda una vez confirmes las 4 preguntas.