# Audit Report — 12.14.3

Generado: 2026-05-28T23:03:17.743Z

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ✅ | 0 archivos |
| Capa (Supabase directo en components/pages) | ✅ | 0 archivos |
| Power-of-10 (>200 líneas) | ✅ | 0 archivos |
| Casts HIGH + CRITICAL | ✅ | 0 / 787 |
| Higiene de tests | ✅ | 0 violaciones |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
✅ Ninguno

### Components/Pages con import directo a Supabase
✅ Ninguno

### Archivos productivos > 200 líneas
✅ Ninguno

## Casts

Total: **787** — HIGH: **0**, CRITICAL: **0**

| Severidad | Cantidad |
|---|---:|
| SAFE | 342 |
| LOW | 14 |
| MEDIUM | 431 |
| HIGH | 0 |
| CRITICAL | 0 |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
| 1 | `src/lib/audit/diffFields.ts` | 12 | 12 |
| 2 | `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx` | 5 | 10 |
| 3 | `src/hooks/embarque/useProformas.ts` | 5 | 10 |
| 4 | `src/services/embarque/queries/exportListado.ts` | 7 | 10 |
| 5 | `src/components/proveedor/EditarProveedorDialog.tsx` | 4 | 8 |
| 6 | `src/components/proveedor/NuevoProveedorDialog.tsx` | 4 | 8 |
| 7 | `src/generators/__tests__/exportCsv.test.ts` | 4 | 8 |
| 8 | `src/hooks/cotizacion/mutations/useCotizacionMutations.ts` | 4 | 8 |
| 9 | `src/lib/csv/leadsCsv.ts` | 4 | 8 |
| 10 | `src/lib/embarque/__tests__/embarquesPageHelpers.test.ts` | 4 | 8 |

## Tests

✅ Sin violaciones.

---

_Estado general: ✅ Baseline arquitectónico limpio._
