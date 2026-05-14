# Eliminar ternarios anidados en la UI

Regla: en `src/components/` y `src/pages/` (código que renderiza UI), reemplazar ternarios anidados por helpers nombrados. Los componentes quedan con un solo ternario simple o una llamada a una función con `if/else` claro.

## Inventario detectado

Archivos con ternarios anidados que se van a refactorizar:

| # | Archivo | Patrón |
|---|---------|--------|
| 1 | `components/portal/dashboard/PortalEstadoEmbarquesCard.tsx:52` | `n !== 1 ? "s" : ""` repetido |
| 2 | `components/layout/SidebarGroupBlock.tsx:91` | `badge === 1 ? "" : "s"` repetido |
| 3 | `pages/Auditoria.tsx:162,167` | misma pluralización |
| 4 | `components/embarque/proforma/PasoConfirmacionProforma.tsx:65` | días de crédito (3 ramas) |
| 5 | `components/embarque/facturacion/HistorialProformas.tsx:50` | mismo formato días de crédito |
| 6 | `components/facturacion/proformasColumns.tsx:65` | mismo formato días de crédito |
| 7 | `components/portal/cotizacion/PortalCotizacionConfirmDialog.tsx:64` | label CTA con 3 estados |
| 8 | `components/portal/EmbarqueCard.tsx:92` | ícono por `modo` (Marítimo/Aéreo/Terrestre) |
| 9 | `components/embarque/TabNotas.tsx:75` | color por `tipo` de nota |
| 10 | `components/embarque/TabDocumentos.tsx:32` | color por `estado` de documento |
| 11 | `components/embarque/StepIndicator.tsx:25-26` | clases por estado del paso |
| 12 | `components/embarque/DialogDuplicarEmbarque.tsx:138` | label de botón pending + plural |
| 13 | `components/facturacion/huecoFacturacionColumns.tsx:83` | tono por días vencidos |
| 14 | `components/facturacion/TabProyeccion.tsx:24` | tono por margen % |
| 15 | `components/cotizacion/conceptos/ConceptoRowUSD.tsx:35` | valor de Select según catálogo |
| 16 | `components/cotizacion/conceptos/ConceptoRowMXN.tsx:28` | igual al anterior |
| 17 | `components/cotizacion/TablaCostosLocal.tsx:96` | valor de input según edición |
| 18 | `pages/admin-org/Configuracion.tsx:41` | label de botón Guardar (3 estados) |

Fuera de alcance (no son UI): `src/lib/`, `src/hooks/`, `src/services/`, `src/generators/` y comparadores de `Array.sort`. La regla del usuario aplica a renderizado.

## Helpers nuevos (compartidos)

Se agregan en módulos existentes para no crear archivos sueltos:

- `src/lib/formatters/index.ts`
  - `pluralS(n: number): string` → `n === 1 ? "" : "s"`. Usado en #1, #2, #3.
  - `formatDiasCredito(d: number | string | null | undefined): string` → `"—" | "Contado" | "N días"`. Usado en #4, #5, #6.
- `src/lib/ui/uiMappings.ts`
  - `getModoIcon(modo: string): LucideIcon` → `Anchor | Plane | Truck`. Usado en #8.
  - `getDocEstadoColorClass(estado: string): string`. Usado en #10.
  - `getNotaTipoColorClass(tipo: string): string`. Usado en #9.
  - `getStepIndicatorClass(currentStep, stepNum): string`. Usado en #11.
  - `getDiasVencidosTone(d: number): "destructive" | "warning" | "default"`. Usado en #13.
  - `getProfitTone(margenPct: number): string`. Usado en #14.

## Helpers locales (alcance de un solo archivo)

Para los casos que no se reutilizan se declara una función local arriba del componente (no `useMemo`, son puras y baratas):

- `PortalCotizacionConfirmDialog.tsx`: `getCtaLabel(isPending, isAceptar)`.
- `DialogDuplicarEmbarque.tsx`: `getCrearBtnLabel(pending, copias)`.
- `ConceptoRowUSD.tsx` / `ConceptoRowMXN.tsx`: `getSelectValue(descripcion, catalogo)`.
- `TablaCostosLocal.tsx`: `getCantidadInputValue(editingQty, gi, cantidad)`.
- `Configuracion.tsx` (admin-org): `getSaveButtonLabel(isSaving, isDirty)`.

## Patrón de refactor

Antes:
```tsx
className={a === 1 ? "x" : a === 2 ? "y" : "z"}
```
Después:
```tsx
function getCls(a: number) {
  if (a === 1) return "x";
  if (a === 2) return "y";
  return "z";
}
// ...
className={getCls(a)}
```

## Verificación

- `bunx vitest run` para tests existentes (formatters, uiMappings ya tienen suite).
- Snapshot manual: días de crédito en proformas, ícono de modo en EmbarqueCard, StepIndicator del wizard.

## Changelog y versión

- `APP_VERSION` → `8.135.5` (patch).
- Entrada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`: "Refactor UI: ternarios anidados reemplazados por helpers nombrados".

## No se cambia

- Lógica de negocio.
- Hooks/servicios.
- Estilos visuales (mismas clases finales).
- Comparadores de orden (`a.id === x ? -1 : ...`) — son lógica, no render.
