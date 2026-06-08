# Audit Report — 12.61.17

Generado: 2026-06-08T13:08:42.904Z

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ✅ | 0 archivos |
| Capa (Supabase directo en components/pages) | ❌ | 2 archivos |
| Power-of-10 (>200 líneas) | ❌ | 6 archivos |
| Casts HIGH + CRITICAL | ⚠️ | 4 / 1145 |
| Higiene de tests | ✅ | 0 violaciones |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
✅ Ninguno

### Components/Pages con import directo a Supabase
- `src/pages/auth/ForgotPasswordDialog.tsx`
- `src/pages/auth/ResetPassword.tsx`

### Archivos productivos > 200 líneas
-  275  `src/features/embarques/components/StepCostosPrecios.tsx`
-  246  `src/pages/auth/Login.tsx`
-  227  `src/lib/mappers/genericPayloadMapper.ts`
-  225  `src/services/facturas/cobranza.ts`
-  209  `src/features/embarques/components/DialogEliminarEmbarque.tsx`
-  207  `src/lib/csv/parseCsv.ts`

## Casts

Total: **1145** — HIGH: **4**, CRITICAL: **0**

| Severidad | Cantidad |
|---|---:|
| SAFE | 432 |
| LOW | 16 |
| MEDIUM | 693 |
| HIGH | 4 |
| CRITICAL | 0 |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
| 1 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 |
| 2 | `src/hooks/profit/__tests__/useProfit.test.tsx` | 8 | 16 |
| 3 | `src/test/setup.ts` | 8 | 16 |
| 4 | `src/generators/cotizacion/__tests__/datosGenerales.test.ts` | 6 | 12 |
| 5 | `src/lib/__tests__/downloadBlob.test.ts` | 6 | 12 |
| 6 | `src/lib/audit/diffFields.ts` | 12 | 12 |
| 7 | `src/lib/domain/estadoResultados.ts` | 7 | 12 |
| 8 | `src/services/cotizacion/conversiones/__tests__/embarquesHelpers.test.ts` | 6 | 12 |
| 9 | `src/services/bitacora/__tests__/index.test.ts` | 10 | 11 |
| 10 | `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx` | 5 | 10 |

## Tests

✅ Sin violaciones.

---

_Estado general: ⚠️ Revisar violaciones arriba._
