# Cast Audit — generado 2026-06-06

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **1111**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 422     | 38.0% |
| LOW       | 1 | 16      | 1.4% |
| MEDIUM    | 2 | 672   | 60.5% |
| HIGH      | 3 | 1     | 0.1% |
| CRITICAL  | 4 | 0 | 0.0% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 1 (~0.1%). El resto es seguro o aceptable bajo política.

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
| 2 | `src/features/auditoria/services/__tests__/revisiones.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 3 | `src/generators/cotizacion/__tests__/datosGenerales.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 4 | `src/lib/audit/diffFields.ts` | 12 | 12 | 6 | 0 | 6 | 0 | 0 |
| 5 | `src/lib/domain/estadoResultados.ts` | 7 | 12 | 1 | 0 | 6 | 0 | 0 |
| 6 | `src/services/cotizacion/conversiones/__tests__/embarquesHelpers.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 7 | `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 8 | `src/features/embarques/hooks/useProformas.ts` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 9 | `src/features/embarques/index.ts` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 10 | `src/hooks/facturacion/__tests__/usePagosFactura.test.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 11 | `src/pdf/documents/__tests__/ProformaHeader.test.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 12 | `src/components/proveedor/EditarProveedorDialog.tsx` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 13 | `src/components/proveedor/NuevoProveedorDialog.tsx` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 14 | `src/components/shared/utils/errorDetailsExtract.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 15 | `src/features/embarques/domain/__tests__/embarquesPageHelpers.test.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

### 1. [HIGH] `src/test/setup.ts:47`

```ts
const g = globalThis as unknown as { __TEST_QUERY_CLIENT__?: { clear: () => void } };
```


## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
