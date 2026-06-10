# Audit Report — 12.76.3

Generado: 2026-06-10T06:01:08.647Z

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ✅ | 0 archivos |
| Capa (Supabase directo en components/pages) | ✅ | 0 archivos |
| Power-of-10 (>200 líneas) | ✅ | 0 archivos |
| Casts HIGH + CRITICAL | ✅ | 0 / 1256 |
| Higiene de tests | ✅ | 0 violaciones |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
✅ Ninguno

### Components/Pages con import directo a Supabase
✅ Ninguno

### Archivos productivos > 200 líneas
✅ Ninguno

## Casts

Total: **1256** — HIGH: **0**, CRITICAL: **0**

| Severidad | Cantidad |
|---|---:|
| SAFE | 454 |
| LOW | 21 |
| MEDIUM | 781 |
| HIGH | 0 |
| CRITICAL | 0 |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
| 1 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 |
| 2 | `src/hooks/profit/__tests__/useProfit.test.tsx` | 8 | 16 |
| 3 | `src/hooks/proveedor/useNuevoProveedorController.ts` | 8 | 16 |
| 4 | `src/test/setup.ts` | 8 | 16 |
| 5 | `src/services/planes/__tests__/index.test.ts` | 7 | 14 |
| 6 | `src/generators/cotizacion/__tests__/datosGenerales.test.ts` | 6 | 12 |
| 7 | `src/lib/__tests__/downloadBlob.test.ts` | 6 | 12 |
| 8 | `src/lib/audit/diffFields.ts` | 12 | 12 |
| 9 | `src/lib/domain/estadoResultados.ts` | 7 | 12 |
| 10 | `src/services/catalogos/__tests__/index.test.ts` | 6 | 12 |

## Tests

✅ Sin violaciones.

---

_Estado general: ✅ Baseline arquitectónico limpio._
