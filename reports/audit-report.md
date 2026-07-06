# Audit Report — 13.195.0

Generado: 2026-07-06T08:03:40.985Z

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ✅ | 0 archivos |
| Capa (Supabase directo en components/pages) | ✅ | 0 archivos |
| Power-of-10 (>200 líneas) | ✅ | 0 archivos |
| Casts HIGH + CRITICAL | ✅ | 0 / 2059 |
| Higiene de tests | ✅ | 0 violaciones |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
✅ Ninguno

### Components/Pages con import directo a Supabase
✅ Ninguno

### Archivos productivos > 200 líneas
✅ Ninguno

## Casts

Total: **2059** — HIGH: **0**, CRITICAL: **0**

| Severidad | Cantidad |
|---|---:|
| SAFE | 569 |
| LOW | 70 |
| MEDIUM | 1420 |
| HIGH | 0 |
| CRITICAL | 0 |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
| 1 | `src/features/embarques/services/cierre.ts` | 17 | 30 |
| 2 | `src/features/cotizacion/components/seccionRuta/__tests__/aplicarTarifa.test.ts` | 13 | 26 |
| 3 | `src/features/cotizacion/services/__tests__/informativa.test.ts` | 10 | 20 |
| 4 | `src/features/facturacion/services/pagos/__tests__/pagosFactura.test.ts` | 11 | 20 |
| 5 | `src/test/setup.ts` | 10 | 20 |
| 6 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 |
| 7 | `src/features/cxp/services/__tests__/proveedorFacturas.helpers.test.ts` | 9 | 18 |
| 8 | `src/features/embarques/domain/mappers/__tests__/embarqueCotizacionDesvincular.test.ts` | 9 | 18 |
| 9 | `src/features/portal/services/__tests__/queries.test.ts` | 9 | 18 |
| 10 | `src/features/cotizacion/services/conversiones/__tests__/embarquesHelpers.integration.test.ts` | 8 | 16 |

## Tests

✅ Sin violaciones.

---

_Estado general: ✅ Baseline arquitectónico limpio._
