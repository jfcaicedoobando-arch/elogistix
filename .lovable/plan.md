## Objetivo

Limpiar la tabla CxP eliminando la columna **Acciones** y mover esas acciones (Pagar, Editar factura, Eliminar factura) dentro del modal que se abre al hacer clic en la fila, además de renombrarlo a **"Detalle de factura de proveedor"**.

## Cambios

### 1) `src/features/cxp/components/cxpColumns.tsx`
- Eliminar la columna `acciones` (botón Pagar + dropdown Ver detalle / Editar / Eliminar).
- Eliminar de `CxPColumnsOptions` las callbacks `onRegistrarPago`, `onEditar`, `onEliminar` (ya no se usan desde la tabla). También `canEdit` puede eliminarse de la firma.
- La tabla queda con: Folio, Folio prov., Proveedor, Emisión, Vencimiento, Días vencido, Mon., Total, Pagado, Saldo, Estatus, Aprobación.

### 2) `src/features/cxp/routes/Cxp.tsx`
- Quitar las callbacks que ya no recibe `buildCxPColumns`.
- Pasar al modal de detalle nuevas callbacks: `onPagar`, `onEditar`, `onEliminar` → reusan `f.setPagar`, `f.setEditar` y `onEliminar` existente.

### 3) `src/features/cxp/components/DialogDetallePagosProveedor.tsx`
- **Renombrar título** a "Detalle de factura de proveedor". La descripción (folio interno · folio prov · proveedor) se mantiene.
- **Nuevos props**: `onPagar(f)`, `onEditar(f)`, `onEliminar(f)`.
- **Nuevo toolbar de acciones** justo después del header (antes de los botones de aprobación), agrupado a la derecha con separador visual:
  - **Registrar pago** (verde primario). Sólo visible si `canEdit && f.saldo > 0 && f.estado !== "Borrador"`. Deshabilitado con tooltip "Requiere aprobación antes de pagar" si `estado_aprobacion !== "aprobada"`.
  - **Editar factura** (outline). Sólo si `canEdit`.
  - **Eliminar factura** (outline destructivo). Sólo si `canEdit`. Cierra este modal y abre el confirm de eliminar.
- Al hacer clic en cualquier acción que abre otro diálogo (Pagar/Editar/Eliminar), cerrar el modal de detalle primero para evitar dos diálogos modales encimados.

### 4) Versionado
- `APP_VERSION` → `13.109.0`.
- Entrada en `CHANGELOG.md` describiendo el rediseño: tabla más limpia, acciones consolidadas en el modal de detalle, nuevo nombre.

## Fuera de scope

- No tocar `useCxpPageState` ni los demás diálogos (Nueva, Editar, Pagar, Confirm eliminar) — sólo se invocan diferente.
- No cambiar `DoubleConfirmDeleteDialog` ni la lógica de "no se puede eliminar si tiene pagos" (toast informativo se mantiene).
- No renombrar el archivo `DialogDetallePagosProveedor.tsx` para evitar churn en imports/tests; sólo cambia el título visible.

## Analogía 🍽️

Era como un menú de restaurante donde cada plato traía sus propios cubiertos en la mesa (pesado, mucho ruido visual). Ahora la mesa queda despejada y los cubiertos llegan **junto con el plato** cuando lo pides — todas las acciones aparecen al abrir el detalle de la factura.
