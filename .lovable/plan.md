

## Plan: Crear `src/hooks/useCotizacionCostos.ts`

### Archivo nuevo

Crear el hook siguiendo el patrón existente de `useCotizaciones.ts` (react-query + supabase client):

1. **Interface `CostoCotizacion`** — mapea los campos de la tabla `cotizacion_costos` (id, cotizacion_id, concepto, proveedor, moneda, unidad_medida, costo, venta, profit, porcentaje_profit, seccion)

2. **`useCotizacionCostos(cotizacionId)`** — `useQuery` con `.select('*').eq('cotizacion_id', cotizacionId)`, habilitado solo cuando `cotizacionId` existe

3. **`useUpsertCostos()`** — `useMutation` que recibe un array de costos parciales (sin profit/porcentaje_profit que son columnas generadas), hace `supabase.from('cotizacion_costos').upsert(costos)` e invalida la query

4. **`useDeleteCosto()`** — `useMutation` que elimina por id e invalida la query

5. **`calcularPL(costos)`** — función pura que retorna totales globales y agrupados por sección (`Origen`, `Flete Internacional`, `Destino`, `Otro`)

### Changelog

Registrar como versión **4.5.1** en `src/pages/Changelog.tsx`.

