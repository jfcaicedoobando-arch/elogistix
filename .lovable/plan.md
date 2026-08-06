# Mostrar el folio interno (FP-XXXXXX) en los archivos recibidos del tab Costos

## El problema

En el detalle de embarque → tab **Costos**, la lista de "archivos recibidos" muestra el folio del documento del proveedor (`folio_serie`), pero no dice en qué factura de proveedor de Libre Carga se convirtió ese archivo. El vínculo ya existe en la base de datos (cada archivo capturado guarda el id de su factura), simplemente no se está leyendo ni mostrando.

## Qué se va a hacer

1. **Traer el folio interno en la consulta**: la consulta que alimenta la lista trae el id de la factura de proveedor pero no su folio. Se agrega la relación para leer `folio_interno`, `estado` y `total` de la factura vinculada.

2. **Mostrar el folio en cada fila**: cuando el archivo ya fue capturado, la fila muestra un chip en tipografía monoespaciada con el folio interno (ej. `FP-000042`), junto al folio del proveedor, de modo que quede claro cuál es "el número del proveedor" y cuál es "el nuestro".

3. **Hacerlo clickeable**: el chip del folio lleva al detalle de la factura de proveedor (`/compras/facturas/:id`), reusando el patrón ya existente en el buzón de compras.

4. **Archivos sin capturar**: si el archivo aún no se convirtió en factura, se mantiene el estado actual (pendiente / rechazado) sin chip, para que la ausencia del folio sea informativa.

5. **Changelog + versión**: se registra el cambio en `CHANGELOG.md` y se sube `APP_VERSION` (patch).

## Detalles técnicos

- `src/features/cxp/services/facturasEntrantes.types.ts`: extender `SELECT_COLS_ENTRANTES` con `proveedor_facturas:proveedor_factura_id(folio_interno, estado, total)` y agregar el campo opcional al tipo `FacturaEntranteRow`.
- `src/features/cxp/services/facturasEntrantes.ts`: ajustar el mapeo/`SAFE-CAST` del join anidado en `listarFacturasEntrantesPorEmbarque`.
- `src/features/embarques/components/entrantes/FacturaEntranteItem.tsx` (`MetaEntrante`): renderizar el chip `font-mono tabular-nums` con `Link to={/compras/facturas/${row.proveedor_factura_id}}`, siguiendo el estilo de `FacturaProveedorHeader.tsx`.
- Sin migración de base de datos: la FK `embarque_facturas_entrantes.proveedor_factura_id` ya existe.
- Verificación: correr los tests de `src/features/cxp/services/__tests__/` (los joins anidados tienen casts marcados) y un check visual del tab Costos a 1920x1080.

## Alcance excluido

No se modifica la lógica de captura, cuadre ni permisos: solo lectura y presentación.
