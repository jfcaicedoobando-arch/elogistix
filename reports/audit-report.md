# Audit Report — 13.823.253

Generado: 2026-09-09T03:39:58.696Z

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ✅ | 0 archivos |
| Capa (Supabase directo en components/pages) | ✅ | 0 archivos |
| Power-of-10 (>200 líneas) | ✅ | 0 archivos |
| Casts HIGH + CRITICAL | ✅ | 0 / 3640 |
| Higiene de tests | ✅ | 0 violaciones |
| Adopción zod en `fromDb` | ⚠️ | 14/51 validados (28%) |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
✅ Ninguno

### Components/Pages con import directo a Supabase
✅ Ninguno

### Archivos productivos > 200 líneas
✅ Ninguno

## Casts

Total: **3640** — HIGH: **0**, CRITICAL: **0**

| Severidad | Cantidad |
|---|---:|
| SAFE | 1042 |
| LOW | 174 |
| MEDIUM | 2424 |
| HIGH | 0 |
| CRITICAL | 0 |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
| 1 | `src/features/embarques/services/cierre.ts` | 18 | 32 |
| 2 | `src/features/cotizacion/services/paginados.ts` | 17 | 29 |
| 3 | `src/features/cxp/services/__tests__/proveedorFacturas.helpers.test.ts` | 14 | 28 |
| 4 | `src/features/embarques/domain/mappers/__tests__/embarqueToDb.test.ts` | 15 | 28 |
| 5 | `src/features/cotizacion/components/seccionRuta/__tests__/aplicarTarifa.test.ts` | 13 | 26 |
| 6 | `src/features/dashboard/direccion/services/loaders.ts` | 14 | 25 |
| 7 | `src/features/embarques/hooks/__tests__/useNuevoEmbarqueCotVinculada.test.tsx` | 11 | 22 |
| 8 | `src/features/configuracion/index.ts` | 10 | 20 |
| 9 | `src/features/cotizacion/services/__tests__/informativa.test.ts` | 10 | 20 |
| 10 | `src/features/cotizacion/services/__tests__/wizard.test.ts` | 10 | 20 |

## Boundaries de datos (`fromDb`)

Call sites validados con zod: **14** de **51** (28%).

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
