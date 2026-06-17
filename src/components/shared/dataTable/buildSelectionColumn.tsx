import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { SelectionCell, SelectionHeader } from "./SelectionCell";
import type { RowSelectionApi } from "./useRowSelection";

/**
 * buildSelectionColumn — agrega una columna de checkbox (id `__select`) al
 * inicio de tus columnas. El consumidor maneja el estado vía `useRowSelection`
 * y le pasa el id resolver de la fila.
 *
 * Uso:
 *   const sel = useRowSelection();
 *   const cols = [buildSelectionColumn(sel, (r) => r.id, pageIds), ...otras];
 */
export function buildSelectionColumn<T>(
  sel: RowSelectionApi,
  getId: (row: T) => string,
  pageRowIds: string[],
): ColumnDef<T, unknown> {
  const allSelected = pageRowIds.length > 0 && pageRowIds.every((id) => sel.selectedIds.has(id));
  const someSelected = !allSelected && pageRowIds.some((id) => sel.selectedIds.has(id));
  return defineColumns<T>([
    {
      id: "__select",
      header: () => (
        <SelectionHeader
          checked={allSelected}
          indeterminate={someSelected}
          onToggle={() => sel.toggleAll(pageRowIds)}
        />
      ),
      meta: { width: "w-[40px]", align: "center", className: "p-0" },
      cell: ({ row }) => {
        const id = getId(row.original);
        return <SelectionCell checked={sel.isSelected(id)} onToggle={() => sel.toggle(id)} />;
      },
      enableSorting: false,
    },
  ])[0];
}
