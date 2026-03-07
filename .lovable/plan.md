

## Plan: Migrar ProveedorDetalle a useProveedorMutations (v4.29.1)

### Cambio
Reemplazar `useProveedores()` (deprecated, carga todos los registros) por `useProveedorMutations()` (solo mutaciones, sin query innecesaria).

### Archivo: `src/pages/ProveedorDetalle.tsx`
- Línea 11: cambiar import de `useProveedores` a `useProveedorMutations`
- Línea 24: cambiar `const { updateProveedor } = useProveedores()` por `const { updateProveedor } = useProveedorMutations()`
- Sin otros cambios — la API de `updateProveedor` es idéntica en ambos hooks

### Archivo: `src/pages/Changelog.tsx`
- Nueva entrada v4.29.1

