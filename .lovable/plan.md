
# Segmentación Nacional / Extranjero en Proveedores y CxP

El campo `origen_proveedor` ya existe en la tabla `proveedores` (valores `Nacional` / `Extranjero`) y se captura en el wizard de alta. Hoy no se ve en listados ni se usa para sugerir el método de pago en CxP. Este plan lo expone en UI y lo aprovecha en conciliación.

## 1. Listado de proveedores (`/proveedores`)

- Agregar **filtro segmentado** Nacional / Extranjero / Todos en la barra superior (junto al search y al tab de tipo).
- Nueva columna **"Origen"** en `proveedorTableColumns.tsx` con badge:
  - `Nacional` → badge azul (`bg-primary/10`)
  - `Extranjero` → badge ámbar
- Extender `fetchProveedoresPaginados` y la RPC `proveedores_listado` para aceptar `p_origen` opcional (filtra por `origen_proveedor`).
- Exponer `origen_proveedor` en `ProveedorListItem`.

## 2. Detalle de proveedor

- Mostrar el origen como badge en el header del detalle.
- En el wizard de edición permitir cambiarlo (hoy solo se captura al crear).

## 3. CxP — Facturas y pagos

- Nueva columna **"Origen"** en `cxpColumns.tsx` (Nacional / Extranjero), derivada del proveedor vinculado.
- Filtro segmentado en `CxpFiltros` y chip en `CxpFiltrosChips` para filtrar por origen.
- En **`DialogRegistrarPagoProveedor`**:
  - Campo "Método de pago" con valores:
    - `SPEI` (default cuando el proveedor es Nacional)
    - `Transferencia internacional` / `SWIFT` (default cuando es Extranjero)
    - `Efectivo`, `Cheque`, `Otro`
  - Mostrar campos de referencia distintos según el método: clave SPEI (18 dígitos) vs MT103/SWIFT reference.
- Persistir el método en `pagos_proveedor.metodo_pago` (columna nueva, texto).

## 4. Carga XML CFDI

- Forzar `origen_proveedor = 'Nacional'` al crear proveedor desde XML CFDI (siempre es mexicano).
- En el flujo de "Capturar factura" manual, si el proveedor seleccionado es Extranjero, ocultar el toggle "Cargar XML CFDI" (no aplica).

## 5. Cambios técnicos

- **Migración**:
  - `ALTER TABLE pagos_proveedor ADD COLUMN metodo_pago text;`
  - Actualizar RPC `proveedores_listado` para aceptar `p_origen text DEFAULT NULL`.
- **Tipos**: regenerar `types.ts` tras migración.
- **Archivos a editar**:
  - `src/services/proveedor/index.ts` (param `origen`, expone campo)
  - `src/pages/proveedores/ProveedorTable.tsx` + `proveedorTableColumns.tsx`
  - `src/pages/proveedores/ProveedoresPage.tsx` (filtro nuevo)
  - `src/components/cxp/CxpFiltros.tsx`, `CxpFiltrosChips.tsx`, `cxpColumns.tsx`
  - `src/components/cxp/DialogRegistrarPagoProveedor.tsx`
  - `src/components/cxp/CrearProveedorDesdeCfdiDialog.tsx` (forzar Nacional)
  - `src/hooks/cxp/useFacturasCxP.ts` (incluir origen en query)
- **Constantes nuevas**: `METODOS_PAGO_PROVEEDOR` en `proveedorConstants.ts`.
- **Versión**: `APP_VERSION` → `12.64.0` + entrada en `CHANGELOG.md`.

## Fuera de alcance

- Reglas de conciliación automática SPEI vs SWIFT (sólo se almacena el método; la conciliación se queda como flujo manual existente).
- Validación del formato exacto de clave SPEI / SWIFT (sólo input libre con hint).
