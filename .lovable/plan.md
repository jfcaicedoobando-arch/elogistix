

## Plan: Campo "Días libres en destino" para Marítimo FCL — v3.12.2

### Migración de base de datos

```sql
ALTER TABLE public.cotizaciones ADD COLUMN dias_libres_destino integer NOT NULL DEFAULT 0;
```

### Cambios en código

#### `src/hooks/useCotizaciones.ts`
- Agregar `dias_libres_destino: number` a `CotizacionRow` y como campo opcional en `CreateCotizacionInput`
- Incluir en el insert de `useCreateCotizacion` con valor por defecto `0`

#### `src/pages/NuevaCotizacion.tsx`
- Agregar estado `diasLibresDestino` (number, default 0)
- En la sección **Ruta**, dentro del bloque de campos adicionales (después de Tiempo de tránsito), renderizar condicionalmente un `Input` numérico "Días libres en destino" solo cuando `esMaritimo && tipoEmbarque === 'FCL'`
- Pasar `dias_libres_destino` al objeto de `crearCotizacion.mutateAsync()`

#### `src/pages/CotizacionDetalle.tsx`
- Mostrar "Días libres en destino" en la sección de Datos Generales, solo cuando el modo sea Marítimo y tipo_embarque sea FCL y el valor sea mayor a 0

#### `src/pages/Changelog.tsx` — Entrada v3.12.2

### Archivos modificados
- `src/hooks/useCotizaciones.ts`
- `src/pages/NuevaCotizacion.tsx`
- `src/pages/CotizacionDetalle.tsx`
- `src/pages/Changelog.tsx`

