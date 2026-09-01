# Cast Audit — generado 2026-09-01

Auditoría automática de los `as` casts en `src/`. Generado por
`scripts/audit-casts.ts`. Para regenerar: `bun scripts/audit-casts.ts`.

## Resumen

Total de `as` casts detectados: **3329**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | 975     | 29.3% |
| LOW       | 1 | 160      | 4.8% |
| MEDIUM    | 2 | 2194   | 65.9% |
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
| 1 | `src/features/embarques/services/cierre.ts` | 17 | 30 | 1 | 2 | 14 | 0 | 0 |
| 2 | `src/features/cotizacion/services/paginados.ts` | 17 | 29 | 2 | 1 | 14 | 0 | 0 |
| 3 | `src/features/dashboard/direccion/services/loaders.ts` | 16 | 29 | 1 | 1 | 14 | 0 | 0 |
| 4 | `src/features/cxp/services/__tests__/proveedorFacturas.helpers.test.ts` | 14 | 28 | 0 | 0 | 14 | 0 | 0 |
| 5 | `src/features/cotizacion/components/seccionRuta/__tests__/aplicarTarifa.test.ts` | 13 | 26 | 0 | 0 | 13 | 0 | 0 |
| 6 | `src/features/embarques/domain/mappers/__tests__/embarqueToDb.test.ts` | 14 | 26 | 1 | 0 | 13 | 0 | 0 |
| 7 | `src/features/cotizacion/services/__tests__/informativa.test.ts` | 10 | 20 | 0 | 0 | 10 | 0 | 0 |
| 8 | `src/features/portal/services/__tests__/queries.test.ts` | 11 | 20 | 1 | 0 | 10 | 0 | 0 |
| 9 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 | 1 | 1 | 9 | 0 | 0 |
| 10 | `src/features/cotizacion/hooks/__tests__/usePaso1SectionStatus.test.tsx` | 9 | 18 | 0 | 0 | 9 | 0 | 0 |
| 11 | `src/features/cotizacion/hooks/wizard/__tests__/useCotizacionWizardSteps.test.tsx` | 9 | 18 | 0 | 0 | 9 | 0 | 0 |
| 12 | `src/features/embarques/domain/mappers/__tests__/embarqueCotizacionDesvincular.test.ts` | 9 | 18 | 0 | 0 | 9 | 0 | 0 |
| 13 | `src/features/facturacion/services/pagos/__tests__/pagosFactura.test.ts` | 10 | 18 | 1 | 0 | 9 | 0 | 0 |
| 14 | `src/test/setup.ts` | 9 | 18 | 0 | 0 | 9 | 0 | 0 |
| 15 | `src/features/configuracion/index.ts` | 8 | 16 | 0 | 0 | 8 | 0 | 0 |

## Top-30 casts más riesgosos (HIGH + CRITICAL)

_Ningún cast HIGH o CRITICAL detectado._

## Roadmap

Ver [`docs/strict-mode-roadmap.md`](./strict-mode-roadmap.md) (cerrado) para el histórico de cómo se llegó a `strict: true`.
