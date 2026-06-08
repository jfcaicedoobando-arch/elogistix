## Objetivo

Forzar paridad explícita entre la `moneda` de cada fila y la moneda objetivo del contenedor padre (bucket USD vs bucket MXN, o el "Total USD" de `StepCostosPrecios`). Cuando una fila no coincida, garantizar dos cosas: (a) la suma SIEMPRE pasa por conversión FX con el tipo de cambio vigente — nunca aritmética nativa silenciosa — y (b) la UI muestra un indicador visible para que el usuario sepa que se aplicó conversión.

## Cambios propuestos

### 1. `src/lib/financial/costosUSD.ts` — helpers de aserción

Agregar (sin romper firmas existentes):

```ts
export interface SumaMixtaResult {
  total: number;
  /** Filas cuya moneda ≠ target (se les aplicó FX). */
  filasMixtas: { index: number; moneda: string }[];
  /** true si todas las filas eran de la moneda target. */
  homogenea: boolean;
}

/** Suma estricta a una moneda objetivo. Convierte vía TC las filas que difieran
 *  y reporta cuáles fueron mixtas. La conversión nunca se omite. */
export function sumarEnMoneda(
  items: { monto: number; moneda: string }[],
  target: Moneda,
  tcUSD: number,
  tcEUR: number,
): SumaMixtaResult;

/** Devuelve los índices de filas cuya moneda no coincide con target. Útil para
 *  marcar visualmente celdas en la UI sin recalcular totales. */
export function detectarFilasMixtas(
  items: { moneda: string }[],
  target: Moneda,
): number[];
```

`sumarEnUSD` existente se mantiene como wrapper de `sumarEnMoneda(..., "USD", ...).total` (firma intacta, sin breaking change).

Internamente `sumarEnMoneda`:

- Convierte cada `monto` a `target` con `convertirAMXN`/`convertirAUSD` ya existentes (precisión vía `currency.js`).
- Si `tcUSD <= 0` o `tcEUR <= 0` y hay filas mixtas → lanza `Error("TC requerido para conversión")` en lugar de aplicar `1` silencioso (defecto actual en `convertirAMXN`).

### 2. `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx`

Los buckets ya están separados (USD y MXN). Usar `detectarFilasMixtas` para:

- Si alguna fila del bucket USD tiene `moneda !== "USD"` → renderizar `<Badge variant="warning">` "Moneda mixta — fila #N convertida con TC".
- Idem para bucket MXN.
- Añadir un `data-testid="bucket-mixed-warning"` para tests.

No se usan FX aquí porque el wizard de cotización trabaja en moneda nativa por bucket; la advertencia avisa al usuario para que corrija manualmente.

### 3. `src/features/embarques/components/StepCostosPrecios.tsx`

Target implícito es USD (es la columna "Total USD" y los totales de resumen).

- Sustituir `sumarEnUSD(...)` por `sumarEnMoneda(..., "USD", tcUSD, tcEUR)` y leer `result.filasMixtas`.
- En cada fila cuyo `moneda !== "USD"`, mostrar un pequeño badge inline junto al `Total USD` ("Conv. {moneda}→USD @{tc}") y aplicar clase `text-amber-600` al input readOnly para indicar visualmente la conversión.
- Si `tcUSD <= 0` o `tcEUR <= 0` y existen filas mixtas, mostrar `ValidationAlert severity="warning"` arriba del card: "Falta tipo de cambio para convertir N filas en moneda extranjera".

### 4. `src/features/embarques/components/conceptos/ConceptoRowUSD.tsx` / `ConceptoRowMXN.tsx`

Recibir prop opcional `targetMoneda: Moneda` y, si `concepto.moneda !== targetMoneda`, renderizar un ícono `<AlertTriangle className="h-3 w-3 text-amber-500">` con `<Tooltip>` "Moneda distinta al grupo — se aplicará conversión con el TC del embarque".

### 5. Tests

- `src/lib/financial/__tests__/costosUSD.test.ts` — agregar bloque `describe("sumarEnMoneda")` cubriendo:
  - Homogeneidad: todas USD → `homogenea: true`, `filasMixtas: []`.
  - Mixta: USD + MXN → `homogenea: false`, índices correctos.
  - Target MXN: convierte USD→MXN con `tcUSD`.
  - Lanza si `tcUSD === 0` y hay fila mixta.
  - `detectarFilasMixtas` retorna índices correctos para EUR en bucket USD.
- `SeccionConceptosVentaCotizacion` — test ligero (RTL) que verifica el badge cuando una fila USD entra en el bucket MXN.

### 6. Versión y changelog

- Bump `APP_VERSION` a `12.61.2`.
- Entrada en `CHANGELOG.md`: "Asserción de paridad de moneda fila ↔ bucket en `costosUSD.ts` + indicador visible (`AlertTriangle` por fila, badge de TC en columna Total USD) en `StepCostosPrecios` y `SeccionConceptosVentaCotizacion`. Conversión FX ahora es obligatoria cuando hay mezcla — falla ruidosamente si falta TC."

### 7. Memoria

Actualizar `mem://technical/financial-calculations-standards`:

- Toda suma multi-fila con moneda objetivo debe usar `sumarEnMoneda` (no `sumarEnUSD` directo) cuando exista bucket UI con moneda implícita.
- Una fila cuya `moneda` difiera de su bucket UI debe mostrar siempre un indicador visible y forzar conversión con TC vigente; nunca sumar nativamente.

## Riesgos

- `sumarEnMoneda` puede lanzar si TC = 0 con filas mixtas (antes pasaba en silencio); mitigamos en `StepCostosPrecios` mostrando `ValidationAlert` antes de invocar.
- Badges nuevos pueden generar ruido visual; uso `Tooltip` para mantener UI limpia y reservar el badge sólo cuando hay mismatch real.

## Pregunta antes de implementar

¿OK incluir la regla "lanzar Error cuando TC = 0 con filas mixtas" en `sumarEnMoneda`, o prefieres que sólo retorne el resultado con FX usando `tc=1` y deje la responsabilidad de la validación a la UI? Lanzar es más estricto (Power-of-10), pero requiere `try/catch` o gating previo en cada consumidor. lanzar error