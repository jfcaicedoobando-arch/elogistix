

## Plan: Agregar campo "Unidad de Medida" a conceptos de venta

### Cambios necesarios

**1. `src/hooks/useCotizaciones.ts`** — Agregar `unidad_medida: string` a la interface `ConceptoVentaCotizacion`

**2. `src/pages/NuevaCotizacion.tsx`** — Agregar `unidad_medida: ''` a las funciones `emptyUSD()` y `emptyMXN()`

**3. `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx`** — En ambas tablas (USD y MXN), agregar una columna "Unidad de Medida" justo después de "Concepto" con un dropdown Select con las opciones: BL, W/M, Documento, Contenedor, Kilo, Embarque. Ajustar las proporciones del grid para acomodar la nueva columna.

**4. `src/pages/CotizacionDetalle.tsx`** — Mostrar la unidad de medida en la vista de detalle si se muestra la tabla de conceptos

**5. `src/pages/Changelog.tsx`** — Nueva entrada

### Catálogo de unidades
```
const UNIDADES_MEDIDA = ['BL', 'W/M', 'Documento', 'Contenedor', 'Kilo', 'Embarque'];
```

### Layout del grid (ajustado)
- **USD**: Concepto (col-span-3) | Unidad (col-span-2) | Cantidad (col-span-1) | P. Unitario (col-span-2) | Total (col-span-2) | Eliminar (col-span-1) → no cambia el total de 12 pero se reduce concepto de 5→3 y se agrega unidad col-span-2
- **MXN**: Concepto (col-span-2) | Unidad (col-span-1) | Cant. (col-span-1) | P. Unit. (col-span-2) | Subtotal (col-span-2) | IVA (col-span-2) | Total (col-span-1) | Eliminar (col-span-1)

