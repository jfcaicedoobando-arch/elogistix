# Folio de NC y REP: Facturapi como source of truth

Hoy las **facturas** siguen este patrón (v13.146.0):
- Al crear borrador se asigna un `numero = 'BORRADOR-<timestamp>'` provisional.
- Al timbrar, la edge `facturapi-emitir` sobreescribe `numero` con `<serie><folio>` devueltos por FacturAPI.

Vamos a replicar exactamente ese patrón para **Notas de Crédito** y a alinear la UI de **REP** (que a nivel datos ya lo cumple).

## 1. Notas de Crédito (`factura_notas_credito`)

Estado actual:
- La columna `folio` es `NOT NULL` y el usuario la escribe a mano en `DialogCrearNotaCredito` (input "Folio interno *", placeholder `NC-001`).
- Al timbrar, `facturapi-emitir-nota-credito` guarda `folio_fiscal` + `serie`, pero **no** toca `folio`. Queda desalineado con lo que emite el SAT.

Cambios:

### 1.1 UI — quitar captura manual
- `src/features/facturacion/components/DialogCrearNotaCredito.tsx`:
  - Eliminar el estado `folio` / `setFolio` y su validación (`!!folio.trim()` en `puedeGuardar`).
  - No pasar `folio`/`setFolio` a `NotaCreditoCamposFiscales`.
  - En el payload de `crearNotaCredito`, mandar el folio provisional `BORRADOR-<ts>` (mismo helper que facturas).
  - Toast de éxito: cambiar `"Folio ${nueva.folio}"` por algo neutro tipo `"Borrador creado"`.
- `src/features/facturacion/components/detalle/NotaCreditoCamposFiscales.tsx`:
  - Quitar el `<Input id="nc-folio">` y las props `folio` / `setFolio`.
- `src/features/facturacion/components/detalle/FacturaNotasCreditoTable.tsx`:
  - Mostrar el folio con la misma lógica que facturas: si el `folio` empieza por `BORRADOR-`, renderizar un chip `Borrador` en gris; si ya fue timbrada, mostrar `${serie}${folio_fiscal}`.

### 1.2 Servicio
- `src/features/facturacion/services/notasCredito.ts`:
  - En `CrearNotaCreditoInput`, hacer `folio` opcional.
  - En `crearNotaCredito`, si no viene folio, generar `BORRADOR-${Date.now().toString().slice(-8)}` (mismo helper que `facturaManual.ts` línea 76).

### 1.3 Edge function — reescribir folio al timbrar
- `supabase/functions/facturapi-emitir-nota-credito/index.ts`, dentro de `persistTimbradoNc`, agregar al `.update({...})`:
  ```ts
  folio: `${serieTimbrada}${folio}`,
  ```
  Con esto la NC queda con folio idéntico al que emite el SAT, igual que las facturas.
- Redeploy: `facturapi-emitir-nota-credito`.

### 1.4 Migración (opcional pero recomendada)
- Backfill de NC ya timbradas: `UPDATE factura_notas_credito SET folio = concat(coalesce(serie,''), folio_fiscal::text) WHERE estado IN ('Timbrada','Aplicada','Cancelada') AND folio_fiscal IS NOT NULL AND folio !~ '^BORRADOR-';` — sólo si quieres homologar históricas. Se hace en migración separada.

## 2. REP (`pagos_factura`)

Estado actual:
- La tabla no tiene un folio interno editable por el usuario. Sólo `folio_rep` + `serie_rep`, ambos poblados por `facturapi-emitir-rep` desde FacturAPI. **Ya cumple** el patrón "Facturapi es source of truth".
- La UI (`FacturaPagosSection.tsx`) no muestra el folio del REP.

Cambios (sólo UI, ninguno de datos):
- `FacturaPagosSection.tsx`: cuando el pago tenga `estado_rep === 'Timbrado'`, mostrar el folio del REP como `${serie_rep}${folio_rep}` junto al UUID (chip verde, mismo tratamiento visual que factura/NC). Cuando esté sin timbrar, chip gris "REP pendiente".
- No se agrega captura manual de folio en ningún flujo de pago — se mantiene explícitamente como sólo-lectura post-timbre.

## 3. Consistencia / mantenimiento

- Bump `APP_VERSION` a `13.213.20`.
- Entrada en `CHANGELOG.md` describiendo: NC ahora usa `BORRADOR-<ts>` en borrador y hereda `<serie><folio>` de FacturAPI al timbrar; UI de REP muestra folio timbrado; consolidación de contrato "FacturAPI = source of truth" para los 3 CFDIs.
- Sin cambios de RLS ni de esquema (columna `folio` de NC ya es `NOT NULL` y el provisional la satisface).
- Tests a actualizar:
  - `src/features/facturacion/services/__tests__/notasCredito*.test.ts` — ajustar cualquier fixture que asuma folio obligatorio del usuario.
  - `supabase/functions/facturapi-emitir-nota-credito/helpers_test.ts` — si hace snapshot del update payload.

## Notas técnicas

- Formato `<serie><folio>` (sin separador) se mantiene por compatibilidad con reportes/búsquedas (ver comentario en `facturapi-emitir/index.ts` líneas 228‑231).
- No se toca `cotizacion-respuesta.tsx`, plantillas de correo ni `send-transactional-email`.
- No cambia el flujo de aprobación/aplicación de NC ni el timbrado en sí, sólo qué se persiste en la columna `folio`.
