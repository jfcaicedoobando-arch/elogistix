# Los cambios sí se guardan, pero la pantalla vuelve a mostrar filas borradas

## Qué está pasando (confirmado en la base)

El guardado del embarque ELEXP00250 funcionó: el RPC `actualizar_embarque_completo` respondió OK y marcó como eliminados los dos conceptos de venta pendientes ("Producto Genérico" 4,005 USD y "Demoras" 1,120 USD) — en la base ambos tienen `deleted_at = 2026-07-30 20:46`.

El problema es la **lectura**: la consulta que alimenta el detalle del embarque no excluye los registros borrados, así que después de guardar vuelve a traer esas filas y parece que "no se grabó nada".

Analogía: tiraste dos hojas a la basura, pero la pantalla sigue leyendo el bote de basura junto con el archivero.

## Alcance del arreglo

1. **Detalle del embarque (causa del reporte)**: en `fetchEmbarqueConceptosVenta` y `fetchEmbarqueConceptosCosto` agregar el filtro de "no borrado".
2. **Barrido de las mismas fugas** en consultas hermanas que leen `conceptos_venta` / `conceptos_costo` sin ese filtro y por lo tanto suman o muestran conceptos eliminados:
   - `src/features/facturacion/services/huecoFacturacion/fetchSources.ts` (totales por embarque)
   - `src/features/facturacion/services/facturasCrud.ts` (costos vinculables a factura)
   - `src/features/proveedor/services/operaciones.ts` (operaciones del proveedor)
   - `src/features/cxp/services/sugerirEmbarques.ts` (sugerencia de embarques)
   - `src/features/proformas/services/queries.ts` (conceptos de una proforma)
3. **Bitácora**: el registro del guardado reportó "1 eliminado" cuando en realidad se eliminaron 2. Ajustar el conteo del diff para que refleje todas las filas retiradas del payload.
4. **Tests**: pruebas de regresión que verifiquen que las consultas del detalle y del barrido aplican el filtro de borrado lógico (mismo patrón que `queries/__tests__/conceptos.test.ts`).

No hace falta migración: la función de guardado ya se comporta correctamente.

## Detalles técnicos

- Añadir `.is("deleted_at", null)` a los `select` listados; el patrón ya existe en `reconciliacionCostos.ts`, `costosConFactura.ts` y `profit/services/estadoResultados.ts`.
- Los conceptos con `estado_facturacion = 'facturado'` no se tocan: el RPC sólo borra `pendiente` con `proforma_id IS NULL`, así que el filtro no oculta nada facturado.
- Actualizar `CHANGELOG.md` y subir `APP_VERSION`.
