## Hallazgos de la verificación

Auditoría completa contra los renombrados del cambio anterior (`13.106.9`). **Sólo se reporta lo visible al usuario**; ignoré nombres de variables/tipos/JSDoc internos y el catálogo SAT (`G03 - Gastos en general` debe quedarse así por ley).

### ✅ OpEx → "Gasto de administración" (faltaron 6)

| # | Archivo:línea | Texto actual | Texto nuevo |
|---|---|---|---|
| 1 | `src/constants/proveedorConstants.ts:27` | `label: 'Gasto operativo'` | `'Gasto de administración'` |
| 2 | `src/features/profit/routes/ProfitPresupuesto.tsx:18` | "Control mensual de gasto operativo por categoría." | "Control mensual de gasto de administración por categoría." |
| 3 | `src/features/presupuesto/components/TabCategorias.tsx:61` | `<h3>Categorías de gasto operativo</h3>` | "Categorías de gasto de administración" |
| 4 | `src/features/presupuesto/components/DialogCategoria.tsx:64` | "Categorías de gasto operativo para el presupuesto." | "Categorías de gasto de administración para el presupuesto." |
| 5 | `src/features/proveedor/components/NuevoProveedorStep1Fields.tsx:39` | `"Gasto operativo: renta, internet, papelería, SaaS, honorarios, etc."` | `"Gasto de administración: renta, internet, papelería, SaaS, honorarios, etc."` |
| 6 | `src/features/dashboard/components/statusCards/ArribosCardTooltips.tsx:135` | `Gastos = facturas de proveedor "Gasto operativo" + comisiones del mes.` | `Gastos = facturas de proveedor "Gasto de administración" + comisiones del mes.` |

### ✅ COGS → "Costos directos del embarque" (faltaron 4)

| # | Archivo:línea | Texto actual | Texto nuevo |
|---|---|---|---|
| 7 | `src/lib/domain/errorCatalog.ts:60` | `costos: "Conceptos de costo"` | `"Costos directos del embarque"` |
| 8 | `src/lib/domain/errorCatalog.ts:125` | `` `Concepto de costo #${p.id}` `` | `` `Costo directo #${p.id}` `` |
| 9 | `src/features/admin/routes/Papelera.tsx:24` | `label: "Conceptos de costo"` | `"Costos directos del embarque"` |
| 10 | `src/features/cxp/components/SugerirEmbarqueBlock.tsx:93` | "...crearemos el concepto de costo automáticamente." | "...crearemos el costo directo del embarque automáticamente." |
| 11 | `src/features/dashboard/routes/ayudaContent.ts:35` | "...se marca cada concepto de costo como Pagado/Pendiente." | "...se marca cada costo directo como Pagado/Pendiente." |
| 12 | `src/features/embarques/components/conceptos/FilaCostoPrecio.tsx:78` | `aria-label="Eliminar concepto de costo"` | `aria-label="Eliminar costo directo"` |

(Son 6 cambios bajo COGS — corrijo el conteo de la sección: 6, no 4.)

## 🚫 NO se tocan (justificación)

- **Catálogo oficial SAT** `src/constants/catalogosSAT.ts:8` → "G03 - Gastos en general" es nombre oficial CFDI; cambiarlo rompe el timbrado.
- **Enum BD `GastoOperativo`** y columna `subtipo_gasto` → identificadores técnicos; renombrar requiere migración riesgosa.
- **Variables/tipos internos** (`gastosOperativosMXN`, `GastoPendiente`, `fetchGastosPendientes`, `isGasto`, `esGasto`, `subtipoGasto`) → no son visibles; cambiarlos es refactor puro sin valor para el contador.
- **Comentarios JSDoc** (`StepCostosPreciosCards.tsx:2`, `FilaCostoPrecio.tsx:2`, `proveedoresCrud.ts`, etc.) → no se muestran al usuario.
- **`LandingPortal.tsx:69`** "Gasto por mes (MXN)" → texto de marketing genérico desde la perspectiva del prospecto; no es etiqueta contable.
- **`SeccionDemorasAuto.tsx:61`** "los conceptos de costo y venta marcados como 'demoras_auto'" → texto compuesto ("costo Y venta"); renombrar sólo "costo" rompe la simetría con "venta". Lo dejaría como está salvo que pidas reescribirlo entero.
- **`facturacion/services/facturasCrud.ts:2`** y similares → comentarios.

## Versionado

- `src/constants/appVersion.ts`: `13.106.9` → `13.106.10`
- `CHANGELOG.md`: entrada `## [13.106.10] - 2026-06-22` — "Cobertura completa del renombrado contable: 12 etiquetas adicionales en filtros de proveedor, presupuesto, papelera, ayuda, tooltip de arribos, catálogo de errores y aria-labels."

## Verificación post-cambio

- `rg -n "Gasto operativo|Conceptos? de costo|Liquidación de gastos" src --glob '!*types.ts' --glob '!catalogosSAT.ts'` → debe regresar **0 resultados visibles**.
- Tests de arquitectura `bunx vitest run src/lib/__tests__/architecture.test.ts` (no debería romperse, sólo cambian strings).

## Analogía 🪧

Es como cambiar los letreros de "Gastos" a "Costos" en una bodega: revisé puerta por puerta y faltaban 12 letreros (sobre todo en los pasillos de Presupuesto, Papelera y Ayuda). Los nombres pintados en las cajas (variables internas) y el sello fiscal SAT no se tocan.
