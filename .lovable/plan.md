

## Plan: Agregar `useConvertirCotizacionAEmbarques()` al final de `useCotizaciones.ts`

### Cambio único

**`src/hooks/useCotizaciones.ts`** — Agregar después de la línea 327 el nuevo hook `useConvertirCotizacionAEmbarques()`:

- `useMutation` que recibe `cotizacion: CotizacionRow`
- Paso 1: Fetch `cotizacion_costos` filtrado por `cotizacion_id`
- Paso 2: Loop `0..num_contenedores-1`, por cada iteración:
  - RPC `generar_expediente` → expediente
  - Insert en `embarques` con los campos mapeados de la cotización
  - Insert en `conceptos_costo` según `unidad_medida`:
    - `'Contenedor'` / `'Embarque'` / `'W/M'` → todos los embarques
    - `'BL'` → solo cuando `i === 0`
- Paso 3: Update cotización estado → `'Convertida'`
- Paso 4: Retorna array de embarques creados
- `onSuccess`: invalida queries `embarques`, `cotizaciones`, `cotizaciones/{id}`

**`src/pages/Changelog.tsx`** — Entrada v4.9.4

No se modifica ningún código existente del archivo.

