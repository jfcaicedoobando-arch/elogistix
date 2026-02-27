

# Ampliar dropdown de Tipo de Contenedor con todos los tipos existentes

## Cambios

### 1. Crear catálogo de contenedores — `src/data/containerTypes.ts`
- Lista completa de tipos de contenedor estándar ISO
- Estructura: `{ code: string, name: string }`
- Incluir: 20' Dry, 40' Dry, 40' HC, 20' Reefer, 40' Reefer, 40' HC Reefer, 20' Open Top, 40' Open Top, 20' Flat Rack, 40' Flat Rack, 20' Tank, 40' Tank, 45' HC, 20' Ventilado, 40' Ventilado, 20' Hard Top, 40' Hard Top, 53' HC (doméstico), etc.

### 2. Actualizar tipo — `src/data/types.ts`
- Ampliar `TipoContenedor` para aceptar `string` o agregar los nuevos valores al union type

### 3. Actualizar formulario — `src/pages/NuevoEmbarque.tsx`
- Reemplazar el `<Select>` hardcodeado de Tipo Contenedor (que solo tiene 20', 40', 40'HC) por un Select que itere sobre el catálogo importado
- Mostrar nombre descriptivo en cada opción

