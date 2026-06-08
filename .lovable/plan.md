## Objetivo

Eliminar drift de punto flotante en los totales del wizard de embarques para que coincidan exactamente con los registros de pago (`DialogRegistrarPago.tsx`). Toda multiplicación `cantidad × precio_unitario` (o `monto` convertido) se envolverá en `currency.js` y se redondeará a 2 decimales **antes** de sumarse al acumulador padre, siguiendo el patrón ya probado en `profitUtils.ts`.

## Aclaración importante

`src/features/embarques/domain/embarqueWizardCostos.ts` hoy es **sólo validación** (no contiene aritmética de totales). Las sumas que alimentan el resumen del paso 4 del wizard viven en:

- `src/lib/financial/embarqueKpis.ts` — `totalEnMxn` (acumulador con `+` plano)
- `src/lib/financial/costosUSD.ts` — `sumarEnUSD` (ya usa `currency.js`, OK)
- `src/features/embarques/components/facturacion/ResumenConceptosVenta.tsx` — `subUsd`/`subMxn` con `reduce` plano
- `src/features/embarques/hooks/useDialogGenerarProformaController.ts` — `subtotal_usd`/`subtotal_mxn` con `reduce` plano

Por consistencia incluyo también los acumuladores equivalentes fuera del wizard que comparten el mismo defecto, ya que los mismos conceptos terminan en factura/proforma/cotización:

- `src/generators/cotizacion/conceptosTables.ts`
- `src/hooks/cotizacion/useConceptosVentaCotizacion.ts`
- `src/hooks/cotizacion/wizard/useConceptosForm.ts`
- `src/lib/parsers/cotizacionDetalle.ts`
- `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx`

Si prefieres limitar el alcance estrictamente al wizard de embarques, dímelo y los dejo fuera.

## Cambios propuestos

### 1. `src/lib/financial/financialUtils.ts`
Agregar helpers reutilizables (basados en `currency.js`, precision 2):

- `subtotalLinea(cantidad, precioUnitario): number` — equivalente a `calcularSubtotal` pero **garantizando** redondeo a 2 decimales por fila.
- `sumarSubtotales<T>(items: T[], get: (i: T) => { cantidad: number; precioUnitario: number }): number` — acumulador que aplica `subtotalLinea` por fila antes de sumar.
- `sumarMontos(montos: number[]): number` — acumulador genérico con `currency.js` (para casos donde la fila ya trae el monto convertido).

`calcularSubtotal` existente se reescribe internamente para delegar en `subtotalLinea` (mantiene firma).

### 2. `src/lib/financial/embarqueKpis.ts`
`totalEnMxn` pasa de `items.reduce((sum, item) => sum + convertirAMXN(...), 0)` a un acumulador `currency(0, { precision: 2 })` que suma cada `convertirAMXN(...)` redondeado.

### 3. Acumuladores de subtotales (mismo patrón en cada sitio)
Reemplazar:
```ts
arr.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0)
```
por:
```ts
sumarSubtotales(arr, (c) => ({ cantidad: c.cantidad, precioUnitario: c.precio_unitario }))
```
en:
- `src/generators/cotizacion/conceptosTables.ts` (subtotalUSD, subtotalMXN, e IVA por fila usando `currency.js`).
- `src/hooks/cotizacion/useConceptosVentaCotizacion.ts` (subtotalMXN + acumulador de IVA).
- `src/hooks/cotizacion/wizard/useConceptosForm.ts`.
- `src/lib/parsers/cotizacionDetalle.ts`.
- `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx` (subtotalSinIvaUSD y análogos).
- `src/features/embarques/components/facturacion/ResumenConceptosVenta.tsx` (subUsd/subMxn).
- `src/features/embarques/hooks/useDialogGenerarProformaController.ts` (subtotal_usd/subtotal_mxn antes del payload de proforma).

Los acumuladores de IVA (`reduce(... calcularIVA(sub, tasa))`) usan también `sumarMontos` para evitar drift en la suma final.

### 4. `src/features/embarques/domain/embarqueWizardCostos.ts`
Sin cambios aritméticos (es validación). Agrego un comentario JSDoc apuntando a `embarqueKpis.ts` / `sumarSubtotales` como fuente única de verdad para totales, para evitar que se reintroduzcan sumas planas aquí.

### 5. Tests
- `src/lib/financial/__tests__/financialUtils.test.ts` — añadir casos para `subtotalLinea`, `sumarSubtotales` y un caso de regresión de drift (ej. 3 filas con `0.1 × 1` que con `+` da `0.30000000000000004` y con currency.js da `0.3`).
- `src/generators/cotizacion/__tests__/conceptosTables.test.ts` — añadir caso de drift con cantidades fraccionarias.
- Revisar que tests existentes sigan pasando (los valores enteros no cambian).

### 6. Versión y changelog
- Bump `APP_VERSION` (parche, ej. `12.61.1`).
- Entrada en `CHANGELOG.md` raíz: "Acumuladores de totales en wizard de embarques y módulos financieros migrados a `currency.js` con redondeo por fila para coincidir exactamente con `DialogRegistrarPago`."

### 7. Memoria
Actualizar `mem://technical/financial-calculations-standards` añadiendo regla: "Toda suma de líneas monetarias debe usar `sumarSubtotales`/`sumarMontos` (currency.js, precision 2); prohibido `reduce((s, x) => s + ..., 0)` sobre montos."

## Riesgos

- Diferencias mínimas (céntimos) respecto a totales históricos calculados con float; aceptable porque ahora coinciden con los pagos en facturación.
- Ningún cambio de esquema DB; ningún cambio de UI visible salvo precisión en el último dígito.

## Pregunta antes de implementar

¿Limito el alcance estrictamente al wizard de embarques (puntos 1, 2, partes de 3 y 4) o aplico también a los acumuladores de cotización/proforma listados (recomendado, asegura paridad end-to-end con `DialogRegistrarPago`)?
