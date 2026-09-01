# Audit Report — 13.823.17

Generado: 2026-09-01T21:55:11.367Z

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ✅ | 0 archivos |
| Capa (Supabase directo en components/pages) | ✅ | 0 archivos |
| Power-of-10 (>200 líneas) | ✅ | 0 archivos |
| Casts HIGH + CRITICAL | ✅ | 0 / 3329 |
| Higiene de tests | ✅ | 0 violaciones |
| Adopción zod en `fromDb` | ⚠️ | 13/50 validados (26%) |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
✅ Ninguno

### Components/Pages con import directo a Supabase
✅ Ninguno

### Archivos productivos > 200 líneas
✅ Ninguno

## Casts

Total: **3329** — HIGH: **0**, CRITICAL: **0**

| Severidad | Cantidad |
|---|---:|
| SAFE | 975 |
| LOW | 160 |
| MEDIUM | 2194 |
| HIGH | 0 |
| CRITICAL | 0 |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
| 1 | `src/features/embarques/services/cierre.ts` | 17 | 30 |
| 2 | `src/features/cotizacion/services/paginados.ts` | 17 | 29 |
| 3 | `src/features/dashboard/direccion/services/loaders.ts` | 16 | 29 |
| 4 | `src/features/cxp/services/__tests__/proveedorFacturas.helpers.test.ts` | 14 | 28 |
| 5 | `src/features/cotizacion/components/seccionRuta/__tests__/aplicarTarifa.test.ts` | 13 | 26 |
| 6 | `src/features/embarques/domain/mappers/__tests__/embarqueToDb.test.ts` | 14 | 26 |
| 7 | `src/features/cotizacion/services/__tests__/informativa.test.ts` | 10 | 20 |
| 8 | `src/features/portal/services/__tests__/queries.test.ts` | 11 | 20 |
| 9 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 |
| 10 | `src/features/cotizacion/hooks/__tests__/usePaso1SectionStatus.test.tsx` | 9 | 18 |

## Boundaries de datos (`fromDb`)

Call sites validados con zod: **13** de **50** (26%).

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
