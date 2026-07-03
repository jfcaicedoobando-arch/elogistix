# Oleada 2 — Migración de módulos maduros a primitivas

Consumir las 9 primitivas creadas en la Oleada 1 en los módulos que ya tienen buen "design language" pero duplican patrones. Sin cambios de negocio ni de UX visible salvo consistencia.

## Módulos en scope (maduros, mismo patrón: lista + filtros + tabla + detalle)

1. **Facturación** (`src/pages/Facturacion.tsx` + `src/features/facturacion/`)
2. **Proformas** (`src/pages/Proformas.tsx` + `src/features/proformas/`)
3. **Cotizaciones** (`src/pages/Cotizaciones.tsx` + `src/features/cotizacion/`)
4. **Embarques** (`src/pages/Embarques.tsx` + `src/features/embarques/`)
5. **Clientes** (`src/pages/Clientes.tsx` + `src/features/cliente/`)

CRM, Costeo, CxP, Auditoría y Admin quedan para la Oleada 4 (legacy con estructura distinta).

## Cambios por página (patrón repetido)

Para cada uno de los 5 módulos:

### A. Contenedor y header
- Envolver el contenido en `<PageContainer>` (quita padding/max-width local duplicado).
- Reemplazar el header manual por `<PageHeader title description icon actions>`. Si tiene tabs internos, moverlos al slot `tabs`.

### B. Estados de carga/error/vacío
- Reemplazar spinners locales por `<LoadingState>`.
- Reemplazar tarjetas de error por `<ErrorState onRetry>`.
- Reemplazar skeletons ad-hoc por `<ListSkeleton variant="table">`.

### C. Badges de estado
- Reemplazar `getEstadoColor`, `BadgeCiclo`, `EmbarqueBadgeAdmin`, `renderEstadoVigencia` en las columnas por `<StatusBadge domain={...}>`.
- Los helpers viejos quedan marcados `@deprecated` (no se borran hasta la Oleada 6).

### D. Filtros
- Reemplazar la barra de filtros custom por `<UnifiedFiltersBar>` alimentado por `useTableFilters`.
- Mantener filtros secundarios de cada dominio en el slot `secondary`.
- Chips activos derivados automáticamente.

### E. Columnas de tabla
- Migrar columnas repetidas a los builders:
  - Estado → `statusColumn({ domain, accessor })`
  - Cliente → `clientColumn({ accessor })`
  - Monto → `moneyColumn({ accessor, currencyAccessor })`
  - Fecha (folio/emisión/etc.) → `dateColumn({ accessor })`
  - Menú de acciones → `actionsColumn({ items })`
- Columnas específicas del dominio (folio, estatus operativo, etc.) quedan tal cual.

### F. Diálogos de confirmación
- Reemplazar los `AlertDialog` inline de "¿Estás seguro?" por `<ConfirmActionDialog>`.
- Los de eliminación destructiva (typable ELIMINAR) usan `<DeleteConfirmDialog>`.
- Preview PDF (proforma, factura, cotización) unifica al `<DocumentPreviewDialog>`.

## Guardrails y no-cambios

- Sin tocar RPCs, RLS, edge functions ni forma de datos.
- Sin renombrar rutas ni props públicos de hooks/servicios.
- Cada archivo tocado sigue Power of 10 (≤ 200 líneas). Si al migrar un `.tsx` de página crece, se extraen sub-componentes.
- Tokens semánticos: cero `text-white` / `bg-[#..]`.
- Retirar del `knip.json > ignore` cada primitiva conforme sus consumidores queden mergeados (`columnBuilders`, `DeleteConfirmDialog`, `DocumentPreviewDialog`, `UnifiedFiltersBar`).

## Tests

- Antes de mergear cada módulo: correr sus tests actuales + los tests de primitivas de la Oleada 1.
- Agregar `useXxxPageController.test.tsx` cobertura para el cableado de `useTableFilters` si no existe.
- No bajar thresholds; si algo baja, escribir tests del nuevo cableado.

## Estrategia de entrega

Ejecuto los 5 módulos en **subtareas paralelas** (subagentes), en 2 lotes para evitar conflictos:

- **Lote A**: Facturación + Proformas + Cotizaciones (comparten `EnviarDocumentoDialog` y helpers financieros).
- **Lote B**: Embarques + Clientes.

Cada lote:
1. Migración de archivos.
2. Correr `bun run lint` y los tests del módulo.
3. Retirar entradas de `knip.json` cuando corresponda.

## Bump y changelog

Un único bump `13.151.0` al cerrar la Oleada 2, con changelog listando los 5 módulos migrados y los helpers marcados como deprecated.

## Cierre

Al terminar la Oleada 2 quedamos listos para la Oleada 3 (formularios/wizards) según el plan original. **No** borrar `plan.md` todavía — eso es el último paso del último wave.
