# Cast Audit — generado 2026-06-08

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **1145**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 432     | 37.7% |
| LOW       | 1 | 16      | 1.4% |
| MEDIUM    | 2 | 693   | 60.5% |
| HIGH      | 3 | 4     | 0.3% |
| CRITICAL  | 4 | 0 | 0.0% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 4 (~0.3%). El resto es seguro o aceptable bajo política.

## Definición de categorías

- **SAFE** — `as const`, `as React.*`, `as ReturnType<typeof X>`. No apagan el chequeo.
- **LOW** — `as Json` (wrapper Supabase), `as unknown` aislado. Aceptable con comentario.
- **MEDIUM** — `as Tables<X>` / `as TablesInsert<X>`. Aceptable **solo dentro de `lib/mappers/*`**.
- **HIGH** — `as unknown as X` (doble cast), `as X[]` sobre respuesta sin validar. Reemplazar por parser/type guard.
- **CRITICAL** — `as any`, `JSON.parse(...) as X`. Eliminar siempre.

## Top-15 archivos por peso de riesgo

| # | Archivo | Total | Peso | SAFE | LOW | MED | HIGH | CRIT |
|---|---------|------:|-----:|-----:|----:|----:|-----:|-----:|
| 1 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 | 1 | 1 | 9 | 0 | 0 |
| 2 | `src/hooks/profit/__tests__/useProfit.test.tsx` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 3 | `src/test/setup.ts` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 4 | `src/generators/cotizacion/__tests__/datosGenerales.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 5 | `src/lib/__tests__/downloadBlob.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 6 | `src/lib/audit/diffFields.ts` | 12 | 12 | 6 | 0 | 6 | 0 | 0 |
| 7 | `src/lib/domain/estadoResultados.ts` | 7 | 12 | 1 | 0 | 6 | 0 | 0 |
| 8 | `src/services/cotizacion/conversiones/__tests__/embarquesHelpers.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 9 | `src/services/bitacora/__tests__/index.test.ts` | 10 | 11 | 4 | 1 | 5 | 0 | 0 |
| 10 | `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 11 | `src/features/embarques/hooks/useProformas.ts` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 12 | `src/features/embarques/index.ts` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 13 | `src/hooks/facturacion/__tests__/usePagosFactura.test.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 14 | `src/lib/parsers/cotizacionDetalle.ts` | 4 | 10 | 0 | 0 | 2 | 2 | 0 |
| 15 | `src/pdf/components/__tests__/DataTable.test.tsx` | 6 | 10 | 1 | 0 | 5 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

### 1. [HIGH] `src/features/embarques/hooks/useEmbarqueDependenciasFinancieras.ts:44`

```ts
const cxcRows = (cxcRes.data ?? []) as unknown as CxcRow[];
```

### 2. [HIGH] `src/features/embarques/hooks/useEmbarqueDependenciasFinancieras.ts:45`

```ts
const cxpRows = (cxpRes.data ?? []) as unknown as CxpRow[];
```

### 3. [HIGH] `src/lib/parsers/cotizacionDetalle.ts:22`

```ts
conceptosVentaUSD: Object.freeze([]) as unknown as ConceptoVentaCotizacion[],
```

### 4. [HIGH] `src/lib/parsers/cotizacionDetalle.ts:23`

```ts
conceptosVentaMXN: Object.freeze([]) as unknown as ConceptoVentaCotizacion[],
```


## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
