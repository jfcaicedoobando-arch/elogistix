
# Refactor de `VirtualDataTable`: hook headless + contenedor de filas

## Objetivo
Bajar `VirtualDataTable.tsx` de ~190 a <100 líneas extrayendo la maquinaria de tabla + virtualizer a un hook headless reusable y aislando el contenedor de filas absolutas en su propio sub-componente. `DataTable.tsx` y el estado page/search (en `useListPageState` / page-state controllers) **no se tocan**, para no duplicar la fuente de verdad de URL state ni romper la regla "TanStack = única fuente de verdad del sort".

## Archivos a crear

### `src/components/shared/dataTable/useVirtualTableState.ts`
Hook headless. Entrada: `{ data, columns, rowKey, parentRef, estimateRowHeight, overscan }`. Salida: `{ table, rows, virtualizer, virtualItems, gridTemplate, leafColumns }`. Encapsula:
- `getRowId` memoizado a partir de `rowKey`.
- `useTableInstance` con `sortMode: "client"` + `enableSorting: false` (mismos defaults actuales).
- Cálculo memoizado de `widthsKey` → `gridTemplate`.
- `measureElement` estable con guard de Firefox.
- `estimateSize` estable.
- `useVirtualizer` conectado a `parentRef`.

### `src/components/shared/VirtualRowsContainer.tsx`
Sub-componente puro que recibe `{ virtualizer, virtualItems, rows, gridTemplate, cellPad, striped, hoverable, onRowClick, rowClassName }` y renderiza el `<div>` con `height = virtualizer.getTotalSize()` que mapea cada `VirtualRow`. Sin lógica, sólo layout.

## Archivos a editar

### `src/components/shared/VirtualDataTable.tsx`
Queda como ensamblador delgado:
1. `withDefaults(props)`.
2. `useRef` del `parentRef`.
3. `useVirtualTableState(...)`.
4. Render: contenedor scrollable + `VirtualHeaderRow` + (`SkeletonRows` | `EmptyState` | `VirtualRowsContainer`) + `PaginationControls`.

### `CHANGELOG.md` + `src/constants/appVersion.ts`
Bump a `12.53.13` con bullet: "Refactor VirtualDataTable: extraer useVirtualTableState (hook headless) y VirtualRowsContainer."

## Lo que NO se hace (y por qué)
- **No se crea `useTableState` genérico para `DataTable`**: ya delega a `useTableInstance` + subcomponentes; añadir capa sería redundante.
- **No se mueve page/search/pageSize a un hook nuevo**: vive (correctamente) en `useListPageState` (URL-synced con `nuqs`) y en controllers por página. Duplicarlo desincronizaría la URL y rompería filtros compartibles.
- **No se introducen `useMemo([...data].sort(...))`**: TanStack sigue siendo la única fuente de verdad del orden (regla documentada en `useTableInstance.ts`).

## Verificación
- `npm test` / vitest: suite de tablas y `architecture.test.ts` deben pasar sin cambios.
- Smoke visual: páginas que usan `VirtualDataTable` (revisar grep) renderizan igual, scroll suave, header sticky, skeleton/empty correctos.
- Conteo de líneas: `VirtualDataTable.tsx` < 100, hook < 100, contenedor < 60.

## Detalles técnicos
- Excepción de `style={{...}}` ya permitida por `mem://principles/inline-styles` para virtualizer (transform/translateY/height dinámicos).
- Sin nuevos `any`, sin `useEffect` añadidos → cleanup no aplica.
- API pública de `VirtualDataTable` no cambia; ningún call-site requiere edición.
