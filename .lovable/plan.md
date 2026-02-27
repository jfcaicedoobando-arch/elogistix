

# Agregar dropdown de puertos del mundo para Puerto Origen y Puerto Destino

## Cambios

### 1. Crear catálogo de puertos — `src/data/ports.ts`
- Lista de ~150 puertos principales del mundo, agrupados por región
- Estructura: `{ code: string, name: string, country: string }` (ej: `{ code: "CNSHA", name: "Shanghai", country: "China" }`)
- Regiones: Asia, América, Europa, Medio Oriente, África, Oceanía

### 2. Crear componente combobox de puertos — `src/components/PortSelect.tsx`
- Combobox buscable usando `Popover` + `Command` (ya instalado como `cmdk`)
- El usuario escribe para filtrar puertos por nombre, país o código
- Muestra resultados como `"Shanghai, China (CNSHA)"`
- Props: `value`, `onValueChange`, `placeholder`

### 3. Actualizar formulario — `src/pages/NuevoEmbarque.tsx`
- Reemplazar los `<Input>` de Puerto Origen y Puerto Destino (líneas 158-159) por el nuevo `<PortSelect>`
- Agregar estado para `puertoOrigen` y `puertoDestino`

