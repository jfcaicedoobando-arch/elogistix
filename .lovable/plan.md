

## Plan: Aplicar formato de moneda mexicana a todos los campos de dinero

### Problema
Varios campos monetarios usan `.toFixed(2)` con prefijo `$` manual en lugar de `formatCurrency()`, que ya usa `Intl.NumberFormat('es-MX')` con separadores de miles y decimales correctos.

### Archivos a modificar

**1. `src/components/embarque/StepCostosPrecios.tsx`** (5 cambios)
- Línea 83: `$${totalUSD.toFixed(2)}` → `formatCurrency(totalUSD, 'USD')`
- Línea 92: `$${totalCostoUSD.toFixed(2)}` → `formatCurrency(totalCostoUSD, 'USD')`
- Línea 118: `$${totalUSD.toFixed(2)}` → `formatCurrency(totalUSD, 'USD')`
- Línea 127: `$${totalVentaUSD.toFixed(2)}` → `formatCurrency(totalVentaUSD, 'USD')`
- Línea 137: `$${(totalVentaUSD - totalCostoUSD).toFixed(2)}` → `formatCurrency(totalVentaUSD - totalCostoUSD, 'USD')`
- Agregar import de `formatCurrency`

**2. `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx`** (4 cambios)
- Línea 149: `c.total.toFixed(2)` → `formatCurrency(c.total, 'USD')`
- Línea 233: `subtotal.toFixed(2)` → `formatCurrency(subtotal, 'MXN')`
- Línea 237: `iva.toFixed(2)` → `formatCurrency(iva, 'MXN')`
- Línea 241: `c.total.toFixed(2)` → `formatCurrency(c.total, 'MXN')`
- Agregar import de `formatCurrency`

**3. `src/pages/CotizacionDetalle.tsx`** (1 cambio)
- Línea 207: `$${Number(...).toLocaleString('es-MX', ...)} USD` → `formatCurrency(Number(cotizacion.valor_seguro_usd || 0), 'USD')`

**4. `src/pages/Reportes.tsx`** (1 cambio)
- Línea 117: chart XAxis tickFormatter — mantener formato abreviado `$12k` pero usar `formatCurrency` para el tooltip (ya está correcto el tooltip)

**5. `src/pages/Changelog.tsx`** — entrada v4.8.5

### No se modifican (no son dinero)
- `peso_volumetrico_kg.toFixed(2)` — peso, no dinero
- `volumen_m3.toFixed(4)` — volumen, no dinero
- `margen.toFixed(1)%` — porcentaje, no dinero

