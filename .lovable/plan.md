# Mejorar modal "Nuevo Proveedor" para Gasto Operativo

## Cambios funcionales

Cuando la categoría es **Gasto Operativo**:

1. **Origen fijo en Nacional**: ocultar el select de Origen y forzar `origen_proveedor = "Nacional"` automáticamente al elegir la categoría.
2. **Carga vía CSF**: agregar bloque "Cargar Constancia de Situación Fiscal (PDF)" arriba del nombre. Al subir el PDF se llama al edge function `parse-csf` (vía `parseCsf()` en `src/services/csf/index.ts`, que ya existe) y se auto-rellenan `nombre` y `rfc`. Mientras procesa: spinner + inputs deshabilitados. Si falla: toast de error y permite captura manual.
3. **Ocultar Moneda Preferida**: el campo desaparece de la UI y se fuerza `moneda_preferida = "MXN"`.

Para **Logístico** todo queda igual (origen seleccionable, sin CSF, moneda visible).

## Archivos a tocar

- `src/hooks/proveedor/useNuevoProveedorController.ts`
  - En `handleCategoriaChange`, cuando pasa a `GastoOperativo` setear `origen_proveedor: "Nacional"` y `moneda_preferida: "MXN"`.
  - Nuevo estado `csfLoading` + handler `handleCsfUpload(file)` que llama `parseCsf`, popula `nombre` y `rfc`, y muestra toast de éxito/error.
- `src/components/proveedor/NuevoProveedorDialog.tsx`
  - Condicionar render del select de Origen y del select de Moneda con `!c.isGasto`.
  - Agregar bloque CSF (input file + botón + estado) visible solo si `c.isGasto`. Reusar estilos de `CrearProveedorDesdeCfdiDialog` como referencia.
- `src/hooks/proveedor/__tests__/useNuevoProveedorController.test.tsx`
  - Caso: al cambiar a GastoOperativo se fija Nacional + MXN.
  - Caso: `handleCsfUpload` con `parseCsf` mockeado rellena nombre y rfc.

## Validaciones

- `isStep1Valid` ya cubre el caso (Nacional forzado satisface el require de origen). No requiere cambios.
- Cancel/reset del diálogo: el reset existente vuelve a `Logistico` + valores limpios, sin cambios.

## Versionado

- `APP_VERSION` → `12.76.6`.
- Entrada en `CHANGELOG.md` describiendo los 3 cambios UX.

## Fuera de alcance

- No se modifica el endpoint `parse-csf` ni el servicio `parseCsf` (ya funcional, usado en alta de clientes).
- No se toca la firma de la tabla `proveedores` ni la RPC `proveedores_listado`.
- No se persiste el PDF de la CSF en storage — solo se extraen datos. Si más adelante se quiere guardar el archivo, queda como mejora futura.
