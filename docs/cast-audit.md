# Cast Audit — generado 2026-05-28

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **750**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 307     | 40.9% |
| LOW       | 1 | 14      | 1.9% |
| MEDIUM    | 2 | 429   | 57.2% |
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
| 1 | `src/lib/audit/diffFields.ts` | 12 | 12 | 6 | 0 | 6 | 0 | 0 |
| 2 | `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 3 | `src/hooks/embarque/useProformas.ts` | 5 | 10 | 0 | 0 | 5 | 0 | 0 |
| 4 | `src/services/embarque/queries/exportListado.ts` | 7 | 10 | 0 | 4 | 3 | 0 | 0 |
| 5 | `src/components/proveedor/EditarProveedorDialog.tsx` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 6 | `src/components/proveedor/NuevoProveedorDialog.tsx` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 7 | `src/generators/__tests__/exportCsv.test.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 8 | `src/hooks/cotizacion/mutations/useCotizacionMutations.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 9 | `src/lib/csv/leadsCsv.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 10 | `src/lib/embarque/__tests__/embarquesPageHelpers.test.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 11 | `src/lib/mappers/cotizacion.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 12 | `src/lib/ui/errorDetailsExtract.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 13 | `src/services/__tests__/tracking.test.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 14 | `src/services/cotizacion/mutations/payloadBuilders.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |
| 15 | `src/services/cotizacion/mutations/update.ts` | 4 | 8 | 0 | 0 | 4 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

_Ningún cast HIGH o CRITICAL detectado._

## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) para el plan de 4 fases hacia `strictNullChecks: true`.
