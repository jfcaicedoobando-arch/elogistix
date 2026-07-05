# Quitar columna "Acciones" de la tabla de Facturación

## Qué cambia

En la lista `/facturacion` la última columna "Acciones" contiene 4 botones (Timbrar, Pagar, Ver pagos, Cancelar). Se elimina por completo. Todas esas operaciones ya existen en el detalle de la factura (`/facturacion/:id`), al que se llega haciendo clic en el # de folio o en la fila.

## Archivos a tocar

### 1. `src/features/facturacion/routes/facturacionColumns.tsx`
- Borrar el objeto de columna `id: "acciones"` (líneas 120-151).
- Quitar del `FacturaColumnsOptions` los campos `canEdit`, `onRegistrarPago`, `onVerPagos`, `onTimbrar`, `onCancelar` (ya no se usan en columnas).
- Quitar imports muertos: `Button`, `DollarSign`, `Eye`, `Stamp`, `Ban`, `esCreadaConCapacidadTimbrado`, y las constantes `ESTADOS_PAGABLES` / `ESTADOS_TIMBRABLES`.

### 2. `src/features/facturacion/routes/Facturacion.tsx`
- Quitar del `buildFacturaColumns({...})` los handlers `onRegistrarPago`, `onVerPagos`, `onTimbrar`, `onCancelar` y el flag `canEdit`.
- Revisar y eliminar el estado/diálogos huérfanos que sólo servían para la lista: `pagoFactura`, `historialFactura`, `timbrarFactura`, `cancelarFactura` y sus dialogs correspondientes, siempre que no se disparen desde otro lugar de la lista (barra superior, menú masivo, etc.). Si alguno se usa además desde una acción masiva o botón del header, se conserva sólo ese uso.

### 3. Tests
- `src/features/facturacion/routes/__tests__/*` (si existe test para `facturacionColumns`): actualizar snapshot / asserts para reflejar que ya no hay columna "Acciones".

## Fuera de alcance

- No se toca el detalle de factura (`FacturaDetalle.tsx`) — ahí siguen viviendo Timbrar, Registrar pago, Ver pagos, Cancelar.
- No se cambia la columna "Archivos" (descarga PDF/XML), que sigue siendo consulta rápida, no acción de estado.
- No se cambia el badge de ambiente ni la navegación al detalle.

## Changelog

Bump `APP_VERSION` + `CHANGELOG.md`:
> UI Facturación: se retira la columna "Acciones" de la tabla. Timbrar, Registrar pago, Ver pagos y Cancelar CFDI se realizan desde el detalle de la factura para evitar operaciones desde una vista de listado con poco contexto.
