# Audit Report — 12.98.3

Generado: 2026-06-13T04:35:12.540Z

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ✅ | 0 archivos |
| Capa (Supabase directo en components/pages) | ✅ | 0 archivos |
| Power-of-10 (>200 líneas) | ✅ | 0 archivos |
| Casts HIGH + CRITICAL | ✅ | 0 / 1374 |
| Higiene de tests | ✅ | 0 violaciones |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
✅ Ninguno

### Components/Pages con import directo a Supabase
✅ Ninguno

### Archivos productivos > 200 líneas
✅ Ninguno

## Casts

Total: **1374** — HIGH: **0**, CRITICAL: **0**

| Severidad | Cantidad |
|---|---:|
| SAFE | 466 |
| LOW | 22 |
| MEDIUM | 886 |
| HIGH | 0 |
| CRITICAL | 0 |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
| 1 | `src/features/cotizacion/services/__tests__/informativa.test.ts` | 10 | 20 |
| 2 | `src/services/pagos-factura/__tests__/pagosFactura.test.ts` | 11 | 20 |
| 3 | `src/services/profit/estadoResultadosDevengado.ts` | 10 | 20 |
| 4 | `src/test/setup.ts` | 10 | 20 |
| 5 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 |
| 6 | `src/features/facturas/services/huecoFacturacion/__tests__/buildFilas.test.ts` | 8 | 16 |
| 7 | `src/hooks/profit/__tests__/useProfit.test.tsx` | 8 | 16 |
| 8 | `src/features/facturas/services/__tests__/facturasIndex.test.ts` | 7 | 14 |
| 9 | `src/lib/sentry.ts` | 7 | 14 |
| 10 | `src/features/cotizacion/services/conversiones/__tests__/embarquesHelpers.test.ts` | 6 | 12 |

## Tests

✅ Sin violaciones.

---

_Estado general: ✅ Baseline arquitectónico limpio._
