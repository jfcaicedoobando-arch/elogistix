# Refactor de tablas a `@tanstack/react-table` — resumen step-by-step

> Cerrado en **APP_VERSION 10.1.3**. Este documento es la fuente única para
> responder "¿por qué tal cosa?" sobre el sistema de tablas. Para autoría
> diaria de columnas usa `docs/datatable-columndef-guide.md`. Para
> presupuestos de perf usa `docs/datatable-perf-audit.md`.

## Objetivo

Eliminar toda la lógica propia de orden, filtros y virtualización de tablas
y delegar la gestión de estado a `@tanstack/react-table` v8 con
`@tanstack/react-virtual` para virtualización. Integración limpia con los
RPCs paginados de Supabase, sin `useEffect` ni `useMemo` reordenando
arreglos.

## Paso 1 — Adapter intermedio (Fase 1, retirada)

Se introdujo `src/components/shared/dataTable/columnAdapter.ts` que tomaba
la API legacy `DataTableColumn<T>` (`key`, `render`, `sortable`,
`sortValue`, `align`, `className`, `width`, `sticky`) y producía un
`ColumnDef<T, unknown>` para TanStack. Sirvió de puente durante la
migración: nuevos call-sites podían usar `ColumnDef` nativo mientras los
existentes seguían funcionando.

**Decisión clave**: migrar todo a TanStack nativo en lugar de mantener
nuestra capa indefinidamente — menos código que mantener, alineado con la
documentación pública del paquete, sin riesgo de divergir.

## Paso 2 — Helpers de orden (`sortingFns.ts`)

Para no perder el comportamiento es-MX que vivía dentro de `sortValue`, se
creó `src/components/shared/dataTable/sortingFns.ts`:

- `sortByString<T>(extract)` → `Intl.Collator("es-MX", { sensitivity: "base" })`.
- `sortByNumber<T>(extract)` → resta directa.
- `sortByDate<T>(extract)` → comparación de timestamps; strings inválidos
  como null.
- Los tres son **null-last** sin importar la dirección.

Esto garantiza que el comportamiento de orden es idéntico al adapter
legacy y que cualquier columna nueva lo herede gratis con sólo pasar
`sortingFn: sortByString<T>((r) => r.campo)`.

## Paso 3 — Migración total (Fase 3) y borrado del adapter

Los ~30 call-sites se reescribieron al patrón nativo:

```tsx
const cols: ColumnDef<EmbarqueRow, unknown>[] = defineColumns<EmbarqueRow>([
  {
    id: "expediente",
    header: "Expediente",
    accessorFn: (r) => r.expediente,
    enableSorting: true,
    sortingFn: sortByString<EmbarqueRow>((r) => r.expediente),
    cell: ({ row }) => <ExpedienteCell embarque={row.original} />,
    meta: { width: "w-[140px]", sticky: true },
  },
]) as ColumnDef<EmbarqueRow, unknown>[];
```

Cambios estructurales:
- `src/components/shared/dataTable/columnAdapter.ts` eliminado.
- `DataTableColumn<T>` y `SortValue` removidos de `types.ts`.
- `DataTable.tsx`, `VirtualDataTable.tsx` y `useTableInstance.ts`
  simplificados para aceptar exclusivamente `ColumnDef<T, unknown>[]`.
- `defineColumns<T>(cols)` es el único helper de declaración (no
  transforma, sólo conserva inferencia de `T` con `meta` augmentado).
- `LibreCargaColumnMeta` (`columnMeta.ts`) augmenta `ColumnMeta` de
  TanStack con `width`, `align`, `sticky`, `stickyRight`, `className`,
  `headerClassName`.

## Paso 4 — `useTableInstance` como único orquestador

```ts
useReactTable<T>({
  data,
  columns,
  getRowId,
  enableSorting,
  manualSorting: isServer,
  state: isServer ? { sorting: sortingState } : undefined,
  onSortingChange: handleSortingChange,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: enableSorting && !isServer ? getSortedRowModel() : undefined,
});
```

- En modo **server** (default real del ERP): `manualSorting: true`, el
  estado de sort viene de `controlledSort` (page state) y los toggles del
  header disparan `onSortChange(key, dir)` que actualiza el state y
  refetchea el RPC.
- En modo **client**: TanStack ordena con `getSortedRowModel` usando las
  `sortingFn` de cada columna.

No hay `useState` paralelo para "el orden activo", no hay `useEffect` que
rehidrate desde `controlledSort`. La única fuente de verdad es TanStack
(en client) o el page-state externo (en server).

## Paso 5 — Virtualización con `@tanstack/react-virtual`

`VirtualDataTable` conecta el `rowModel` de TanStack al virtualizer:

```tsx
const table = useTableInstance({ data, columns, sortMode: "client", enableSorting: false, getRowId });
const rows = table.getRowModel().rows;
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize,           // useCallback
  overscan,
  measureElement,         // memoizado a nivel de módulo, con bypass para Firefox
});
```

Optimizaciones que mantienen el rerender de 5k filas en ~2ms (medido en
`DataTable.perf.test.tsx`):

1. **`VirtualRow` envuelto en `React.memo`** con comparador propio que
   verifica `row`, `index`, `start`, `cellPad`, `gridTemplate`, `striped`,
   `hoverable`, `onRowClick`, `rowClassName`, `measureRef`.
2. **`gridTemplate`** memoizado por set y widths de columnas (no se
   reconstruye en scroll).
3. **`measureElement`, `estimateSize`, `getRowId`** estables entre renders
   (callbacks/const de módulo).
4. **`getSortedRowModel` deshabilitado** en virtualizada: los datasets
   grandes vienen pre-ordenados del servidor.

## Paso 6 — Integración con Supabase

El patrón canónico que toda página debe seguir:

```tsx
const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>({
  key: "fecha_etd", dir: "desc",
});
const [page, setPage] = useState(0);

const { data, totalPages, isLoading } = useEmbarquesQuery({
  page, pageSize: 20,
  orderBy: sort.key, orderDir: sort.dir,
});

<DataTable
  columns={cols}
  data={data}
  rowKey={(r) => r.id}
  isLoading={isLoading}
  sortMode="server"
  controlledSort={sort}
  onSortChange={(key, dir) => { setSort({ key, dir }); setPage(0); }}
  pagination={{ page, totalPages, onPageChange: setPage }}
/>
```

Reglas:
- `id` de columna === `column` que el RPC pasa a `.order(...)`. No mezclar
  con `accessorKey` cuando hay `accessorFn`.
- `onSortChange` siempre resetea `page = 0`.
- `(null, "asc")` del callback significa "el usuario llegó a unsorted";
  cae al orden default del RPC.
- `sortMode="server"` ⇒ el componente nunca reordena en cliente, aunque
  `controlledSort` y `data` se vean inconsistentes durante una ráfaga.

Para datasets sin paginación natural (audit log, idempotencia, papelera)
se usa `VirtualDataTable` y el orden lo entrega el RPC en una sola query.

## Paso 7 — Tests que bloquean regresiones

`src/components/shared/dataTable/__tests__/`:

- `DataTable.regression.test.tsx` (16 tests) — render, ciclo de orden
  server-side, colación es-MX, null-last, proyección de `meta` visual.
- `DataTable.e2e.test.tsx` (10 tests) — harness `<EmbarquesHarness/>` con
  filtro externo + sort server + paginación controlada. Cubre reset de
  página al filtrar/ordenar, ciclo asc→desc→null, empty state, isLoading
  y montaje de `VirtualDataTable` con paginación.
- `DataTable.perf.test.tsx` (6 benchmarks) — presupuestos para mount de
  50/1k/5k/10k filas y rerender con `data` por referencia.

Si alguien reintroduce `useMemo([...data].sort(...))`, un `useEffect` que
rehidrate orden, o destruye la identidad del `rowModel`, alguno de los
presupuestos se dispara y la suite truena.

## Paso 8 — Documentación operativa

- `docs/datatable-columndef-guide.md` — receta canónica, mapeo 1:1 desde
  la API legacy, anti-patrones, checklist de PR.
- `docs/datatable-perf-audit.md` — tabla de mediciones, escalado
  sublinear, garantías invariantes (data/columns/callbacks estables).
- Este archivo — bitácora cronológica del refactor.

## Lo que NO se hizo (decisiones explícitas)

- **No se usa `getFilteredRowModel` cliente** en tablas de listado del
  ERP: rompería la paginación server y la perf medida. Los filtros se
  resuelven en el RPC.
- **No hay wrapper "amigable" sobre `ColumnDef`**: `defineColumns<T>` +
  helpers ya cubren el 100% de casos sin reabrir la deuda del adapter.
- **No se mantiene compatibilidad con la API legacy**: cualquier archivo
  que aún use `DataTableColumn<T>` no compila — debe migrarse siguiendo
  la guía.

## Referencias rápidas

- `src/components/shared/DataTable.tsx`
- `src/components/shared/VirtualDataTable.tsx`
- `src/components/shared/VirtualRow.tsx`
- `src/components/shared/dataTable/useTableInstance.ts`
- `src/components/shared/dataTable/defineColumns.ts`
- `src/components/shared/dataTable/sortingFns.ts`
- `src/components/shared/dataTable/columnMeta.ts`
- `src/components/shared/dataTable/__tests__/`
- `docs/datatable-columndef-guide.md`
- `docs/datatable-perf-audit.md`
