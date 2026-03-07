

## Plan: Auditoría y centralización de cálculos financieros

### Hallazgos

Inline math duplicado en 4 ubicaciones:

1. **`useDashboardData.ts:164-165`** — `venta - costo` y `(profit / venta) * 100` (ya en `useMemo`, correcto)
2. **`StepCostosPrecios.tsx:48-56`** — función local `toUSD()` (conversión a USD) y `.reduce()` sin memoización
3. **`SeccionCostosInternosPLUnificado.tsx:62-68`** — `calcTotals()` local duplica `calcularTotalesPL` de profitUtils, más inline profit/pct en líneas 149-151 y 365-367
4. **`EmbarqueDetalle.tsx:173-176`** — `.reduce()` inline (ya usa `calcularUtilidad`/`calcularMargen`, bien)

### Cambios planificados

#### 1. `src/lib/financialUtils.ts` — Agregar `convertirAUSD` y tipo estricto `Moneda`

Agregar función pura `convertirAUSD(monto, moneda, tcUSD, tcEUR)` que reemplaza la función local `toUSD` en StepCostosPrecios. Agregar tipo `Moneda = 'USD' | 'MXN' | 'EUR'` y actualizar firmas de `convertirAMXN` y la nueva función para usar ese tipo.

#### 2. `src/lib/profitUtils.tsx` — Agregar return type explícito a `calcularTotalesPL`

Definir interface `TotalesPL` con `totalCosto`, `totalVenta`, `profit`, `porcentaje` y usarla como return type.

#### 3. `src/components/embarque/StepCostosPrecios.tsx` — Reemplazar `toUSD` local

Importar `convertirAUSD` de financialUtils. Envolver `totalCostoUSD` y `totalVentaUSD` en `useMemo`.

#### 4. `src/hooks/useDashboardData.ts:164-165` — Usar `calcularUtilidad` y `calcularMargen`

Reemplazar inline math con imports de financialUtils (ya está en `useMemo`).

#### 5. `src/components/cotizacion/SeccionCostosInternosPLUnificado.tsx` — Eliminar `calcTotals` local

Reemplazar con `calcularTotalesPL` de profitUtils (adaptando la interfaz de entrada). Reemplazar inline profit/pct en las filas con `calcularUtilidad` y `calcularMargen`.

#### 6. `src/pages/Changelog.tsx` — Agregar entrada v4.19.0

### Archivos a modificar
- `src/lib/financialUtils.ts` (agregar tipo `Moneda`, función `convertirAUSD`)
- `src/lib/profitUtils.tsx` (agregar interface `TotalesPL`, tipar return)
- `src/components/embarque/StepCostosPrecios.tsx` (importar utils, `useMemo`)
- `src/hooks/useDashboardData.ts` (importar `calcularUtilidad`, `calcularMargen`)
- `src/components/cotizacion/SeccionCostosInternosPLUnificado.tsx` (eliminar `calcTotals`, usar utils)
- `src/pages/Changelog.tsx`

