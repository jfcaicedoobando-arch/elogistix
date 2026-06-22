## Cambio

Para proveedores **Nacionales** se elimina por completo el campo **Tipo** (ya no se pide al dar de alta ni al editar, ni se valida). La categoría contable se captura en cada factura.

Para proveedores **Extranjeros** se mantiene el dropdown de Tipo con las 3 opciones (Naviera, Aerolínea, Agente de Carga), porque ahí sí distingue el rol operativo del proveedor.

## Comportamiento

- **Alta nacional**: ya no se muestra el bloque "Tipo". El proveedor se guarda con `tipo = null`.
- **Alta extranjera**: igual que hoy — Tipo requerido entre Naviera/Aerolínea/Agente de Carga.
- **Edición**: si un proveedor nacional existente ya tenía un `tipo` (dato legacy), se conserva en BD pero no se muestra en el formulario.
- **Validación**: `tipo` deja de ser requerido cuando `origen_proveedor = 'Nacional'`. Se ajusta `isFormValid`, `validateField` y los tests.
- **Listado / filtros**: si hay un filtro o columna "Tipo" en el directorio, sigue mostrándose para los extranjeros (el nacional sale en blanco / "—").

## Archivos a tocar

- `src/features/proveedor/hooks/useNuevoProveedorController.ts` — quitar `tipo` de validaciones cuando origen es Nacional; no autollenar `tipo: "Naviera"` al elegir Logístico nacional.
- `src/features/proveedor/hooks/useEditarProveedorController.ts` — mismo ajuste en validaciones.
- `src/features/proveedor/components/NuevoProveedorStep1.tsx` (o donde se renderiza `TipoLogisticoSelect`) — ocultar el componente cuando `origen_proveedor === 'Nacional'`.
- `src/features/proveedor/components/EditarProveedorDialog.tsx` — agregar condición `origen_proveedor === 'Extranjero'` al bloque de Tipo.
- Tests afectados en `src/features/proveedor/hooks/__tests__/*` — actualizar casos que esperan `tipo` requerido para nacional.

## Versionado

- `APP_VERSION` → `13.111.2`
- Entrada en `CHANGELOG.md`.

## Fuera de alcance

- No se elimina la columna `tipo` ni el enum `tipo_proveedor` de BD (datos históricos intactos).
- No se tocan facturas ni la lógica de categoría contable (ya migrada en 13.111.0).
- No se cambia nada para proveedores extranjeros más allá de lo ya hecho en 13.111.1.