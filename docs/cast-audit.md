# Cast Audit — generado 2026-06-10

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **1256**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 454     | 36.1% |
| LOW       | 1 | 21      | 1.7% |
| MEDIUM    | 2 | 781   | 62.2% |
| HIGH      | 3 | 0     | 0.0% |
| CRITICAL  | 4 | 0 | 0.0% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = 0 (~0.0%). El resto es seguro o aceptable bajo política.

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
| 3 | `src/hooks/proveedor/useNuevoProveedorController.ts` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 4 | `src/test/setup.ts` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |
| 5 | `src/services/planes/__tests__/index.test.ts` | 7 | 14 | 0 | 0 | 7 | 0 | 0 |
| 6 | `src/generators/cotizacion/__tests__/datosGenerales.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 7 | `src/lib/__tests__/downloadBlob.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 8 | `src/lib/audit/diffFields.ts` | 12 | 12 | 6 | 0 | 6 | 0 | 0 |
| 9 | `src/lib/domain/estadoResultados.ts` | 7 | 12 | 1 | 0 | 6 | 0 | 0 |
| 10 | `src/services/catalogos/__tests__/index.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 11 | `src/services/cotizacion/conversiones/__tests__/embarquesHelpers.test.ts` | 6 | 12 | 0 | 0 | 6 | 0 | 0 |
| 12 | `src/services/bitacora/__tests__/index.test.ts` | 10 | 11 | 4 | 1 | 5 | 0 | 0 |
| 13 | `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 14 | `src/features/costeo/services/navieraCondiciones.ts` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 15 | `src/features/embarques/hooks/useProformas.ts` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

_Ningún cast HIGH o CRITICAL detectado._

## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
