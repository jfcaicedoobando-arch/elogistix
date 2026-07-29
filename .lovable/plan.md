## Qué está pasando

En `/compras/facturas` aparecen facturas que **ya fueron eliminadas**. Al darles clic en "Eliminar", la base de datos responde `LC_FACTURA_PROVEEDOR_NOT_FOUND` porque para ella ese registro ya no existe.

Analogía: es como una lista de contactos que sigue mostrando a alguien que ya borraste; al marcarle, la línea está desconectada.

Verificado en la base: la factura **FP-000002** fue eliminada el 28/07 a las 17:31 y sigue apareciendo en el listado. Hoy no se registró ninguna eliminación nueva, lo que confirma que el clic fue sobre una fila fantasma.

## Causa raíz

`fetchFacturasCxP` y `fetchFacturaProveedor` (en `src/features/cxp/services/proveedorFacturas.ts`) filtran por estado `Cancelada`, pero **no filtran `deleted_at IS NULL`**. Todas las demás consultas de facturas de proveedor (reportes, presupuesto, tesorería, profit, reconciliación) sí lo hacen — es el único par que quedó sin el filtro.

## Cambios

1. **`src/features/cxp/services/proveedorFacturas.ts`**
   - Agregar `.is("deleted_at", null)` a la consulta del listado (`fetchFacturasCxP`).
   - Agregar el mismo filtro a `fetchFacturaProveedor` (detalle), para que un deep-link a una factura borrada devuelva "no encontrada" en vez de mostrarla como viva.

2. **`src/features/cxp/hooks/useFacturaProveedorMutations.ts`**
   - En `onError` de la eliminación: si el error trae `LC_FACTURA_PROVEEDOR_NOT_FOUND`, mostrar un mensaje claro ("Esta factura ya había sido eliminada; actualizamos la lista") e invalidar `queryKeys.cxp.all` para que la fila fantasma desaparezca sola.

3. **Tests** — agregar caso en los tests de servicios de CxP verificando que el listado aplica el filtro `deleted_at IS NULL`.

4. **Versión y changelog** — bump de `APP_VERSION` a `13.322.16` y entrada en `CHANGELOG.md`.

## Fuera de alcance

No se toca la función de base de datos `soft_delete_proveedor_factura`: su comportamiento es correcto (rechazar el borrado de algo ya borrado). El problema es de la lectura, no del borrado.
