# Audit Report — 11.63.0

Generado: 2026-05-27T04:24:04.249Z

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ✅ | 0 archivos |
| Capa (Supabase directo en components/pages) | ✅ | 0 archivos |
| Power-of-10 (>200 líneas) | ✅ | 0 archivos |
| Casts HIGH + CRITICAL | ⚠️ | 3 / 750 |
| Higiene de tests | ✅ | 0 violaciones |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
✅ Ninguno

### Components/Pages con import directo a Supabase
✅ Ninguno

### Archivos productivos > 200 líneas
✅ Ninguno

## Casts

Total: **750** — HIGH: **3**, CRITICAL: **0**

| Severidad | Cantidad |
|---|---:|
| SAFE | 297 |
| LOW | 9 |
| MEDIUM | 441 |
| HIGH | 3 |
| CRITICAL | 0 |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
| 1 | `src/lib/parsers/dashboard.ts` | 7 | 14 |
| 2 | `src/services/embarque/queries/exportListado.ts` | 7 | 14 |
| 3 | `src/components/admin/TabSeguridadGlobal.tsx` | 6 | 12 |
| 4 | `src/lib/audit/diffFields.ts` | 12 | 12 |
| 5 | `src/lib/mappers/embarqueToDb.ts` | 6 | 12 |
| 6 | `src/services/embarque/documentos.ts` | 6 | 12 |
| 7 | `src/components/auditoria/HallazgosFiltros.tsx` | 5 | 10 |
| 8 | `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx` | 5 | 10 |
| 9 | `src/hooks/embarque/useProformas.ts` | 5 | 10 |
| 10 | `src/components/proveedor/EditarProveedorDialog.tsx` | 4 | 8 |

## Tests

✅ Sin violaciones.

---

_Estado general: ✅ Baseline arquitectónico limpio._
