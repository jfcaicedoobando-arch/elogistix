

## Plan: Campo "Días libres de almacenaje" para Marítimo LCL — v3.12.3

La columna `dias_almacenaje` (integer, default 0) ya existe en la tabla `cotizaciones`. No se requiere migración.

### Cambios en código

#### `src/hooks/useCotizaciones.ts`
- Agregar `dias_almacenaje: number` a `CotizacionRow`
- Agregar `dias_almacenaje?: number` a `CreateCotizacionInput`
- Incluir en el insert de `useCreateCotizacion` con valor por defecto `0`

#### `src/pages/NuevaCotizacion.tsx`
- Agregar estado `diasAlmacenaje` (number, default 0)
- En la sección Ruta, junto al campo "Tiempo de tránsito", renderizar condicionalmente un `Input` numérico "Días libres de almacenaje" cuando `esMaritimo && tipoEmbarque === 'LCL'` (al lado de Tiempo de tránsito, en el mismo grid)
- Pasar `dias_almacenaje` al objeto de `crearCotizacion.mutateAsync()`

#### `src/pages/CotizacionDetalle.tsx`
- Mostrar "Días libres de almacenaje" en Datos Generales cuando el modo sea Marítimo, tipo_embarque sea LCL y el valor sea mayor a 0

#### `src/pages/Changelog.tsx` — Entrada v3.12.3

### Archivos modificados
- `src/hooks/useCotizaciones.ts`
- `src/pages/NuevaCotizacion.tsx`
- `src/pages/CotizacionDetalle.tsx`
- `src/pages/Changelog.tsx`

