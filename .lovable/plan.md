## Fallos CI a corregir (4)

Todos son tests desactualizados respecto a cambios anteriores ya integrados (v13.302.10/11 y v13.303.0/8). Ningún bug real de producto — sólo hay que sincronizar las guardas.

### 1. `sentry-edge-coverage.test.ts`
`supabase/functions/facturapi-recuperar-claim/index.ts` (v13.303.2) usa `wrapEdgeHandler` pero no está listado.
**Fix:** añadirla a `WRAPPED_COVERAGE`. Además debe agregarse al array `CRITICAL` de `sentry-edge-wrapping.test.ts` para mantener sincronización.

### 2. `useEmbarqueEstadoActions.test.tsx > getSiguienteEstado`
Espera `Borrador → Confirmado`, pero la secuencia oficial ahora es `Borrador → Cotización → Confirmado → En Tránsito → En Aduana → Llegada → Arribo → Entregado → EIR → Cerrado` (más lateral `En Proceso → En Aduana`).
**Fix:** actualizar las expectativas del test a la secuencia real; añadir aserción para `En Proceso → En Aduana`.

### 3. `dashboard.test.ts > parseConteoPorEstado`
`EMPTY_CONTEO` incluye `Cotización`, `En Proceso`, `Llegada` (v13.302.11). El test compara con `toEqual` un objeto con sólo 6 llaves.
**Fix:** completar el objeto esperado con las 9 llaves de `EMPTY_CONTEO` (`Cotización:0`, `En Proceso:0`, `Llegada:0`).

### 4. `cxp-multimoneda-fase-l.test.ts`
`readLatestContaining("monto_en_moneda_factura")` ahora encuentra primero la nueva migración de `validar_cierre_embarque` (v13.303.8) que menciona la columna en un SELECT pero no la crea con ALTER TABLE.
**Fix:** cambiar el marker de la primera aserción a `"ADD COLUMN IF NOT EXISTS monto_en_moneda_factura"` para forzar que resuelva a la migración correcta de Fase L. Los otros 3 markers ya son específicos.

### Versionado
Bump `APP_VERSION` a `13.303.10` y entrada en `CHANGELOG.md`:
> Fix CI: sincronizadas guardas de tests con secuencia oficial de estados de embarque, `EMPTY_CONTEO` completo, cobertura Sentry de `facturapi-recuperar-claim` y marker específico de migración Fase L.

### Verificación
`bun run ci:fast` — esperar 0 fallos de test.
