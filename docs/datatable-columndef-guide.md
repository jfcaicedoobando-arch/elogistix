# Guía de migración y autoría de tablas — `ColumnDef` nativo

> Vigente desde **APP_VERSION 10.0.0** (refactor Fase 3). Suplanta cualquier
> referencia al API legacy `DataTableColumn<T>` / `sortValue` / `render` /
> `key`, que **ya no existe** en el proyecto.

Este documento es el contrato único que debe seguir cualquier tabla nueva o
migración futura. Si tu PR no lo respeta, no debería pasar review.

---

## 1. TL;DR — la receta correcta

```tsx
import {
  DataTable,
  defineColumns,
  type ColumnDef,
} from "@/components/shared/DataTable";
import {
  sortByString,
  sortByNumber,
  sortByDate,
} from "@/components/shared/dataTable/sortingFns";

interface EmbarqueRow {
  id: string;
  expediente: string;
  cliente: string | null;
  total: number | null;
  etd: string | null; // ISO
}

const columns: ColumnDef<EmbarqueRow, unknown>[] = defineColumns<EmbarqueRow>([
  {
    id: "expediente",
    header: "Expediente",
    accessorFn: (r) => r.expediente,
    enableSorting: true,
    sortingFn: sortByString<EmbarqueRow>((r) => r.expediente),
    cell: ({ row }) => <ExpedienteCell embarque={row.original} />,
    meta: { width: "w-[140px]", sticky: true, className: "font-medium" },
  },
  {
    id: "cliente",
    header: "Cliente",
    accessorFn: (r) => r.cliente,
    enableSorting: true,
    sortingFn: sortByString<EmbarqueRow>((r) => r.cliente),
    cell: ({ row }) => row.original.cliente ?? "—",
  },
  {
    id: "total",
    header: "Total",
    accessorFn: (r) => r.total,
    enableSorting: true,
    sortingFn: sortByNumber<EmbarqueRow>((r) => r.total),
    cell: ({ row }) => formatMXN(row.original.total),
    meta: { align: "right", width: "w-[120px]" },
  },
  {
    id: "etd",
    header: "ETD",
    accessorFn: (r) => r.etd,
    enableSorting: true,
    sortingFn: sortByDate<EmbarqueRow>((r) => r.etd),
    cell: ({ row }) => formatDateMX(row.original.etd),
  },
]) as ColumnDef<EmbarqueRow, unknown>[];
```

Y el render:

```tsx
<DataTable
  columns={columns}
  data={rows}
  rowKey={(r) => r.id}
  sortMode="server"
  controlledSort={sort}
  onSortChange={(key, dir) => setSort({ key, dir })}
  pagination={{ page, totalPages, onPageChange: setPage }}
/>
```

---

## 2. Reglas obligatorias

### 2.1 Usar siempre `defineColumns<T>([...])`

Activa la augmentación de `meta` (`LibreCargaColumnMeta`) y conserva la
inferencia de `T` sin necesidad de anotar cada campo. La aserción final
`as ColumnDef<T, unknown>[]` se mantiene **sólo** para preservar el contrato
de la prop `columns` y evitar incompatibilidades de variancia con genéricos
estrictos — no es un escape de tipos.

### 2.2 `id` es **obligatorio** y se usa como clave de orden server-side

El `onSortChange(key, dir)` devuelve exactamente este `id`. Cuando el RPC
de Supabase espera columnas como `expediente`, `fecha_etd`, `cliente_nombre`,
usa **el mismo string** como `id`. No dependas de `accessorKey` para esto:
cuando hay `accessorFn`, TanStack genera ids posicionales y romperás el
mapeo con el backend.

### 2.3 Datos crudos en `accessorFn`, formato visual en `cell`

- `accessorFn: (r) => r.total` → es lo que ven los sorters/filters.
- `cell: ({ row }) => formatMXN(row.original.total)` → es lo que se pinta.

Nunca pongas el string formateado en `accessorFn`: rompería el orden
numérico/de fecha.

### 2.4 Ordenamiento: `sortingFn` con los helpers centralizados

| Tipo de columna | Helper a usar                                  |
|-----------------|------------------------------------------------|
| Texto           | `sortByString<T>((r) => r.campo)`              |
| Números/MXN/USD | `sortByNumber<T>((r) => r.campo)`              |
| Fechas (ISO)    | `sortByDate<T>((r) => r.campo)`                |

- Todos son **null-safe**: `null`/`undefined` van al final independientemente
  de la dirección. No reimplementes esto por columna.
- `sortByString` usa `Intl.Collator("es-MX", { sensitivity: "base" })`:
  acentos y mayúsculas insensibles. **No** uses `String.prototype.localeCompare`
  manual.
- Si necesitas un sort exótico (e.g. ordenar por enum con prioridad),
  escribe una `SortingFn<T>` ad-hoc en el mismo archivo de columnas, pero
  **mantén el contrato null-last**.

### 2.5 `enableSorting` explícito

Marca `enableSorting: true` SOLO en las columnas que el header debe permitir
ordenar. El resto las dejas sin la prop (default `false` cuando el dataset
viene del server). Un header sin `enableSorting` no muestra el icono ni
dispara `onSortChange`.

### 2.6 `meta` para look & feel — nunca CSS suelto en `cell`

`LibreCargaColumnMeta`:

```ts
interface LibreCargaColumnMeta {
  className?: string;       // se aplica a cada <td> de la columna
  headerClassName?: string; // se aplica al <th>
  width?: string;           // Tailwind: "w-[140px]" o token de grid
  align?: "left" | "right" | "center";
  sticky?: boolean;         // pin a la izquierda
  stickyRight?: boolean;    // pin a la derecha (col. de acciones)
}
```

- `align: "right"` debe usarse para totales, montos, contadores; combínalo
  con `tabular-nums` en `className` cuando hagan match visual con columnas
  vecinas.
- `width` controla tanto `DataTable` (TableCell) como `VirtualDataTable`
  (gridTemplate). Si lo omites en virtual, la columna ocupa `minmax(0,1fr)`.
- `sticky` / `stickyRight` requieren que el contenedor padre sea
  `overflow-x-auto` (lo es por default en `DataTable`).

### 2.7 Server-side sort + paginación: el patrón Embarques

```tsx
const [sort, setSort] = useState<{ key: string | null; dir: "asc" | "desc" }>({
  key: "fecha_etd",
  dir: "desc",
});
const [page, setPage] = useState(0);

const { data, totalPages, isLoading } = useEmbarquesQuery({
  page,
  pageSize: 20,
  orderBy: sort.key,
  orderDir: sort.dir,
});

<DataTable
  columns={columns}
  data={data}
  rowKey={(r) => r.id}
  isLoading={isLoading}
  sortMode="server"               // crítico: no re-ordena en cliente
  controlledSort={sort}
  onSortChange={(key, dir) => {
    setSort({ key, dir });
    setPage(0);                   // reiniciar al cambiar orden
  }}
  pagination={{
    page,
    totalPages,
    onPageChange: setPage,
  }}
/>
```

Reglas adicionales:
- `sortMode="server"` ⇒ el componente **no** reordena `data` aunque le pases
  `controlledSort`. La responsabilidad es del RPC. Si quieres orden cliente
  sobre un dataset chico, usa el default (`sortMode="client"`) y deja que
  TanStack lo haga.
- El callback `onSortChange` recibe `(null, "asc")` cuando el ciclo de
  TanStack llega a "unsorted" (3er click). Tu reducer puede traducirlo a
  "vuelve al orden default del RPC".
- Al cambiar orden o filtro **siempre** resetea `page` a 0.

### 2.8 `VirtualDataTable`: cuándo y cómo

Úsala cuando puedas tener cientos o miles de filas en la misma vista y la
altura por fila pueda variar (notas largas, payloads). API idéntica salvo:
- No expone `sortMode` controlado: el rowModel se entrega pre-ordenado por
  el servidor (sin orden cliente).
- Requiere `estimateRowHeight` (default 44px) y `maxHeight` (default 600px).
- `meta.width` con valores fijos (`"180px"`, `"w-[180px]"`) ayuda al
  `gridTemplate` a no recalcularse durante scroll.

### 2.9 Click en fila vs. acciones internas

Si la fila tiene `onRowClick`, **toda** acción interna (DropdownMenu,
botones de borrar, checkboxes, links) debe envolver su `onClick` en
`e.stopPropagation()`. Es regla del proyecto (Core memory).

```tsx
cell: ({ row }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      onClick={(e) => e.stopPropagation()}
      asChild
    >
      <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
    </DropdownMenuTrigger>
    ...
  </DropdownMenu>
),
```

---

## 3. Migración desde la API legacy (mapeo 1:1)

| Legacy `DataTableColumn<T>`         | Nativo `ColumnDef<T>` (Fase 3+)                                                  |
|-------------------------------------|----------------------------------------------------------------------------------|
| `key: "expediente"`                 | `id: "expediente"`                                                               |
| `header: "Expediente"`              | `header: "Expediente"`                                                           |
| `render: (row) => <X/>`             | `cell: ({ row }) => <X embarque={row.original}/>`                                |
| `sortable: true`                    | `enableSorting: true`                                                            |
| `sortValue: (row) => row.total`     | `accessorFn: r => r.total` + `sortingFn: sortByNumber(r => r.total)`             |
| `align: "right"`                    | `meta: { align: "right" }`                                                       |
| `className: "tabular-nums"`         | `meta: { className: "tabular-nums" }`                                            |
| `headerClassName: "text-right"`     | `meta: { headerClassName: "text-right" }`                                        |
| `width: "w-[140px]"`                | `meta: { width: "w-[140px]" }`                                                   |
| `sticky: true`                      | `meta: { sticky: true }`                                                         |

> Si encuentras un archivo que aún use el shape legacy, **no compilará**:
> `columnAdapter.ts` y los tipos `DataTableColumn<T>` / `SortValue` fueron
> eliminados en 10.0.0. Migra siguiendo la tabla.

---

## 4. Anti-patrones (rechazar en review)

1. **Ordenar arrays con `useMemo`/`useEffect`**: TanStack es la única fuente
   de verdad. Si tienes un `useMemo(() => [...rows].sort(...))`, bórralo y
   pásale el orden a `sortingFn` o al RPC.
2. **`accessorKey` cuando hay `accessorFn`**: usa uno u otro. Con
   `accessorFn`, el `id` es obligatorio.
3. **Formato en `accessorFn`**: rompe el orden numérico/de fecha. Formato
   sólo en `cell`.
4. **`any` en `ColumnDef`**: nunca. `defineColumns<T>` infiere `T`; si
   necesitas un union, declara la interfaz `T` explícita.
5. **Sort cliente sobre datasets paginados server**: produce páginas
   inconsistentes. Usa `sortMode="server"` siempre que `pagination` apunte
   a un RPC.
6. **`onSortChange` sin resetear `page`**: el usuario verá una página vacía
   o filas duplicadas. Resetea siempre.
7. **CSS suelto en `cell` para alineación/ancho**: rompe `VirtualDataTable`
   (que arma su propio grid). Va en `meta`.
8. **Más de ~200 líneas por archivo de columnas**: si crece, extrae celdas
   pesadas (`<ExpedienteCell/>`, `<EstadoBadge/>`) a componentes propios.
   Regla Power of 10.

---

## 5. Tests obligatorios para tablas nuevas

Toma como referencia
`src/components/shared/dataTable/__tests__/DataTable.e2e.test.tsx`. Para
cualquier tabla nueva no-trivial, agrega como mínimo:

- Render del header y de N filas conocidas.
- Click en header sortable → `onSortChange("col", "asc")`.
- Click 3 veces → ciclo `asc → desc → null`.
- Header no-sortable no dispara `onSortChange`.
- Empty state cuando `data=[]`.
- (Si aplica) cambio de filtro externo resetea `page` y filtra filas.

---

## 6. Checklist para PRs

- [ ] Cada columna tiene `id` único y estable.
- [ ] `accessorFn` devuelve **dato crudo**; el formato va en `cell`.
- [ ] `enableSorting` sólo donde aplica.
- [ ] `sortingFn` viene de `sortingFns.ts` (no ad-hoc salvo justificación).
- [ ] Look & feel en `meta`, **nada** de CSS suelto en `cell`.
- [ ] Si hay paginación server, `sortMode="server"` y reseteo de `page` en
      cambios de orden/filtro.
- [ ] `onRowClick` + acciones internas con `e.stopPropagation()`.
- [ ] Archivo de columnas ≤ 200 líneas; celdas complejas extraídas.
- [ ] Tests de regresión actualizados.
- [ ] Changelog (`src/content/changelogData.ts` + `chunk0`) actualizado.

---

## Referencias

- `src/components/shared/DataTable.tsx` — render + paginación + server sort.
- `src/components/shared/VirtualDataTable.tsx` — variante virtualizada.
- `src/components/shared/dataTable/defineColumns.ts` — helper tipado.
- `src/components/shared/dataTable/sortingFns.ts` — `sortByString/Number/Date`.
- `src/components/shared/dataTable/columnMeta.ts` — augmentación de `meta`.
- `src/components/shared/dataTable/__tests__/` — suites de regresión y E2E.
- `docs/migracion-tabla-fase2.md` — historial de migración Fase 2 (archivo).
