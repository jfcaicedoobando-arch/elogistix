

## Plan: Reescribir `src/hooks/useCotizacionCostos.ts`

Reemplazar el contenido completo del archivo con la nueva estructura solicitada:

### Interface `CostoCotizacion`
- Campos: `id`, `cotizacion_id`, `concepto`, `moneda` (`'USD' | 'MXN'`), `proveedor`, `cantidad`, `costo_unitario`, `costo_total`, `created_at`, `updated_at`

### Hook `useCotizacionCostos(cotizacionId)`
- `useQuery` a `cotizacion_costos` filtrado por `cotizacion_id`, habilitado solo con `cotizacionId` presente

### Hook `useUpsertCotizacionCostos()`
- `useMutation` que recibe `{ cotizacionId, costos }`
- DELETE todos los registros del `cotizacion_id`, luego INSERT del array completo (sin enviar `costo_total` ya que es columna generada)
- Invalida `['cotizacion_costos', cotizacionId]` en `onSuccess`

### Función `calcularPL(conceptosVenta, costos)`
- Importa `ConceptoVentaCotizacion` de `@/hooks/useCotizaciones`
- Separa por moneda y calcula:
  - **USD**: `totalVenta`, `totalCosto`, `profit`, `porcentajeProfit`
  - **MXN**: `subtotalVenta` (sin IVA, usando `cantidad * precio_unitario`), `totalCosto`, `profit`, `porcentajeProfit`, `iva` (16%), `totalConIva`

### Nota
- Se eliminan las funciones/exports anteriores (`useUpsertCostos`, `useDeleteCosto`, `calcularTotalCostos`) que ya no aplican

