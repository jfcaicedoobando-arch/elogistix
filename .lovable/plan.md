

# Agregar dropdown de navieras en el formulario de Nuevo Embarque

## Cambios

### 1. Crear catálogo de navieras — `src/data/shippingLines.ts`
- Lista de ~40 navieras principales del mundo
- Estructura: `{ code: string, name: string }` (ej: `{ code: "MAERSK", name: "Maersk Line" }`)
- Incluir: Maersk, MSC, CMA CGM, COSCO, Hapag-Lloyd, Evergreen, ONE, Yang Ming, HMM, ZIM, PIL, Wan Hai, KMTC, etc.

### 2. Crear componente combobox — `src/components/ShippingLineSelect.tsx`
- Mismo patrón que `PortSelect`: combobox buscable con `Popover` + `Command`
- Filtrar por nombre o código
- Props: `value`, `onValueChange`, `placeholder`

### 3. Actualizar formulario — `src/pages/NuevoEmbarque.tsx`
- Reemplazar el `<Input>` de Naviera (línea 163) por `<ShippingLineSelect>`
- Agregar estado `naviera`

