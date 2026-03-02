

## Plan: Campo "Días de almacenaje" para Marítimo LCL — v3.12.3

### Migración de base de datos

```sql
ALTER TABLE public.cotizaciones ADD COLUMN dias_almacenaje integer NOT NULL DEFAULT 0;
```

### Cambios en código

#### `src/hooks/useCotizaciones.ts`
- Agregar `dias_almacenaje: number` a `CotizacionRow`
- Agregar `dias_almacenaje?: number` a `CreateCotizacionInput`
- Incluir en el insert de `useCreateCotizacion` con valor por defecto `0`

#### `src/pages/NuevaCotizacion.tsx`
- Agregar estado `diasAlmacenaje` (number, default 0)
- Reset a 0 en `handleCambiarTipoEmbarque`
- En la sección de Ruta, renderizar condicionalmente un `Input` numérico "Días de almacenaje" solo cuando `esMaritimo && tipoEmbarque === 'LCL'`, con `min={0}` y `step={1}`, filtrando decimales
- Validación: campo obligatorio (> 0) antes de enviar cuando aplique
- Pasar `dias_almacenaje` al objeto de `crearCotizacion.mutateAsync()`

#### `src/pages/CotizacionDetalle.tsx`
- Mostrar "Días de almacenaje" en Datos Generales cuando modo sea Marítimo, tipo_embarque sea LCL y el valor sea mayor a 0

#### `src/pages/Changelog.tsx` — Entrada v3.12.3

### Archivos modificados
- `src/hooks/useCotizaciones.ts`
- `src/pages/NuevaCotizacion.tsx`
- `src/pages/CotizacionDetalle.tsx`
- `src/pages/Changelog.tsx`

