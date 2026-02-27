

# Agregar 4 nuevos tipos de proveedor

## Archivos a modificar

### 1. `src/data/types.ts` (línea 8)
Agregar al union type `TipoProveedor`: `'Custodia' | 'Almacenes' | 'Acondicionamiento de Carga' | 'Materiales Peligrosos'`

### 2. `src/pages/Proveedores.tsx` (líneas 15-22)
Agregar 4 pestañas nuevas al array `TABS`:
- `{ label: 'Custodia', tipo: 'Custodia' }`
- `{ label: 'Almacenes', tipo: 'Almacenes' }`
- `{ label: 'Acondicionamiento', tipo: 'Acondicionamiento de Carga' }`
- `{ label: 'Mat. Peligrosos', tipo: 'Materiales Peligrosos' }`

### 3. `src/components/NuevoProveedorDialog.tsx` (línea 9)
Agregar los 4 tipos al array `TIPOS`

### 4. `src/components/EditarProveedorDialog.tsx` (línea 9)
Agregar los 4 tipos al array `TIPOS`

