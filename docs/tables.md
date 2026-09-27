# Tablas — Libre Carga

Contrato actual: **`ColumnDef` nativo de TanStack Table 8**.
La API `DataTableColumn`/`render`/`sortValue` y `columnAdapter.ts` fue retirada.
[Guía completa de columnas](datatable-columndef-guide.md).
Revisado el **2026-09-26**.

## Componentes

`DataTable` de `src/components/shared/DataTable.tsx`, `DetailTable` para
detalle y `ResponsiveDataTable` para tarjetas/listado según breakpoint.
`VirtualDataTable` para volúmenes que requieren virtualización.
No usar tabla raw fuera de las excepciones de `eslint.config.js`.

## Columnas

`defineColumns<T>()`, ids únicos/estables, `accessorFn` con dato crudo,
`cell` con formato, `sortingFn` compartida y `meta` para ancho/alineación/sticky.
No mezclar APIs, ordenar dinero formateado ni duplicar estados de sort.

```tsx
const columns = defineColumns<Fila>([
  {
    id: "total",
    accessorFn: (r) => r.total,
    header: "Total",
    enableSorting: true,
    sortingFn: sortByNumber<Fila>((r) => r.total),
    cell: ({ row }) => formatCurrency(row.original.total),
    meta: { align: "right", className: "tabular-nums" },
  },
]);
```

Fragmento ilustrativo: importar helpers y definir `Fila` en el módulo real.

## Datos y estados

- Dataset paginado por servidor: `sortMode="server"`, sort/filtros en queryKey,
  reiniciar página al cambiar ambos. No ordenar sólo la página actual.
- Dataset completo pequeño: sort cliente con TanStack.
- Densidad mediante `TABLE_DENSITY.listado` / `embebida`, no strings copiados.
- Paginación compartida, pasar total real para rango de registros.
- Distinguir loading/error/vacío; `isError` y `onRetry` para fallo de consulta.
- Identificador de fila estable, no índice de array.
- Acciones internas no deben disparar navegación por fila.
- Sticky conserva fondo/selección/hover y no oculta contenido.
- Diseñar estrategia estrecha; no esconder el único acceso a una acción.
- Validar 1280×720, 691×763, teclado, textos largos y oscuro.

La guía de diseño gobierna acabado visual; la de columnas gobierna API.
