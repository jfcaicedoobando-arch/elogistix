# Audit Report — 13.780.0

Generado: 2026-08-28T05:55:23.650Z

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ✅ | 0 archivos |
| Capa (Supabase directo en components/pages) | ✅ | 0 archivos |
| Power-of-10 (>200 líneas) | ✅ | 0 archivos |
| Casts HIGH + CRITICAL | ✅ | 0 / 3221 |
| Higiene de tests | ✅ | 0 violaciones |
| Adopción zod en `fromDb` | ⚠️ | 12/49 validados (25%) |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
✅ Ninguno

### Components/Pages con import directo a Supabase
✅ Ninguno

### Archivos productivos > 200 líneas
✅ Ninguno

## Casts

Total: **3221** — HIGH: **0**, CRITICAL: **0**

| Severidad | Cantidad |
|---|---:|
| SAFE | 956 |
| LOW | 152 |
| MEDIUM | 2113 |
| HIGH | 0 |
| CRITICAL | 0 |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
| 1 | `src/features/embarques/services/cierre.ts` | 17 | 30 |
| 2 | `src/features/cxp/services/__tests__/proveedorFacturas.helpers.test.ts` | 14 | 28 |
| 3 | `src/features/cotizacion/components/seccionRuta/__tests__/aplicarTarifa.test.ts` | 13 | 26 |
| 4 | `src/features/embarques/domain/mappers/__tests__/embarqueToDb.test.ts` | 14 | 26 |
| 5 | `src/features/cotizacion/services/__tests__/informativa.test.ts` | 10 | 20 |
| 6 | `src/features/portal/services/__tests__/queries.test.ts` | 11 | 20 |
| 7 | `src/features/cotizacion/hooks/wizard/cotizacionDraftStorage.ts` | 10 | 19 |
| 8 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 |
| 9 | `src/features/cotizacion/hooks/__tests__/usePaso1SectionStatus.test.tsx` | 9 | 18 |
| 10 | `src/features/cotizacion/hooks/wizard/__tests__/useCotizacionWizardSteps.test.tsx` | 9 | 18 |

## Boundaries de datos (`fromDb`)

Call sites validados con zod: **12** de **49** (25%).

Casts crudos `fromDb<T>()` pendientes por feature:

| Feature | Pendientes |
|---|---:|
| `cotizacion` | 8 |
| `admin` | 6 |
| `proformas` | 6 |
| `configuracion` | 4 |
| `embarques` | 4 |
| `catalogos` | 3 |
| `proveedor` | 2 |
| `auditoria` | 1 |
| `dashboard` | 1 |
| `operaciones` | 1 |
| `lib` | 1 |

## Tests

✅ Sin violaciones.

---

_Estado general: ✅ Baseline arquitectónico limpio._
