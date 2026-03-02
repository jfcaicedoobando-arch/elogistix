

## Plan: Campo "Carta garantía" (Sí/No) para Marítimo FCL — v3.12.4

### Migración de base de datos

```sql
ALTER TABLE public.cotizaciones ADD COLUMN carta_garantia boolean NOT NULL DEFAULT false;
```

### Cambios en código

#### `src/pages/NuevaCotizacion.tsx`
- Agregar estado `cartaGarantia` (boolean, default false)
- Después del bloque de "Días libres en destino" (línea 408), dentro de la misma condición `esMaritimo && tipoEmbarque === 'FCL'`, agregar un `Select` dropdown con opciones "Sí" / "No"
- Pasar `carta_garantia` al objeto de `crearCotizacion.mutateAsync()`

#### `src/hooks/useCotizaciones.ts`
- Agregar `carta_garantia: boolean` a `CotizacionRow`
- Agregar `carta_garantia?: boolean` a `CreateCotizacionInput`
- Incluir en el insert con valor por defecto `false`

#### `src/pages/CotizacionDetalle.tsx`
- Mostrar "Carta garantía: Sí/No" en Datos Generales cuando modo sea Marítimo y tipo_embarque sea FCL

#### `src/pages/Changelog.tsx` — Entrada v3.12.4

### Archivos modificados
- `src/hooks/useCotizaciones.ts`
- `src/pages/NuevaCotizacion.tsx`
- `src/pages/CotizacionDetalle.tsx`
- `src/pages/Changelog.tsx`

