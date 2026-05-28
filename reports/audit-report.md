# Audit Report — 12.14.1

Generado: 2026-05-28T22:47:09.675Z

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ❌ | 3 archivos |
| Capa (Supabase directo en components/pages) | ✅ | 0 archivos |
| Power-of-10 (>200 líneas) | ❌ | 5 archivos |
| Casts HIGH + CRITICAL | ⚠️ | 5 / 753 |
| Higiene de tests | ✅ | 0 violaciones |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
- `src/hooks/cotizacion/wizard/handlePaso1Crm.ts`
- `src/hooks/crm/useCrmProspectoSearch.ts`
- `src/hooks/embarque/useContenedoresInfoMap.ts`

### Components/Pages con import directo a Supabase
✅ Ninguno

### Archivos productivos > 200 líneas
-  279  `src/pdf/theme/styles.ts`
-  228  `src/lib/domain/embarqueWizardSchemas.ts`
-  220  `src/hooks/embarque/useDialogGenerarProformaController.ts`
-  212  `src/components/embarque/facturacion/ResumenConceptosVenta.tsx`
-  212  `src/lib/domain/proforma.ts`

## Casts

Total: **753** — HIGH: **5**, CRITICAL: **0**

| Severidad | Cantidad |
|---|---:|
| SAFE | 307 |
| LOW | 12 |
| MEDIUM | 429 |
| HIGH | 5 |
| CRITICAL | 0 |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
| 1 | `src/lib/audit/diffFields.ts` | 12 | 12 |
| 2 | `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx` | 5 | 10 |
| 3 | `src/hooks/embarque/useProformas.ts` | 5 | 10 |
| 4 | `src/services/embarque/queries/exportListado.ts` | 7 | 10 |
| 5 | `src/services/cotizacion/conversiones/embarques.ts` | 4 | 9 |
| 6 | `src/components/proveedor/EditarProveedorDialog.tsx` | 4 | 8 |
| 7 | `src/components/proveedor/NuevoProveedorDialog.tsx` | 4 | 8 |
| 8 | `src/generators/__tests__/exportCsv.test.ts` | 4 | 8 |
| 9 | `src/hooks/cotizacion/mutations/useCotizacionMutations.ts` | 4 | 8 |
| 10 | `src/lib/csv/leadsCsv.ts` | 4 | 8 |

## Tests

✅ Sin violaciones.

---

_Estado general: ⚠️ Revisar violaciones arriba._
