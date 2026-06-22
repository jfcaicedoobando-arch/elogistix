## Cambio

Cuando el origen del proveedor sea **Extranjero**, el dropdown de "Tipo" sólo mostrará:

- Naviera
- Aerolínea
- Agente de Carga

Para proveedores **Nacionales** la lista completa se mantiene igual (Transportista, Agente Aduanal, Aseguradora, Custodia, Almacenes, Acondicionamiento de Carga, Materiales Peligrosos también disponibles).

## Archivos a tocar

- `src/constants/proveedorConstants.ts` — agregar export `TIPOS_PROVEEDOR_EXTRANJERO` con los 3 valores.
- `src/features/proveedor/components/NuevoProveedorStep1Fields.tsx` — usar la lista filtrada cuando `form.origen_proveedor === "Extranjero"`.
- `src/features/proveedor/components/EditarProveedorDialog.tsx` — misma lógica al editar.
- Si el `tipo` actual del proveedor extranjero no está entre los 3 permitidos al abrir el editor, se mostrará igualmente como opción legacy para no romper datos existentes.

## Versionado

- `APP_VERSION` → `13.111.1`
- Entrada en `CHANGELOG.md` describiendo el filtrado.

## Fuera de alcance

- No se toca el enum de BD `tipo_proveedor` (se conserva intacto para datos históricos).
- No cambia la categoría contable ni filtros del directorio.