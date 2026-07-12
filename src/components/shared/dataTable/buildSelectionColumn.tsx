import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * buildSelectionColumn — agrega una columna de checkbox (id `__select`) al
 * inicio de tus columnas. La selección se maneja con el estado nativo de
 * TanStack (`state.rowSelection`) — el caller usa `useRowSelection` y pasa
 * `rowSelection` + `onRowSelectionChange` al `<DataTable>`.
 *
 * Uso:
 *   const sel = useRowSelection();
 *   const cols = [buildSelectionColumn<Row>(), ...otras];
 *   <DataTable
 *     rowSelection={sel.rowSelection}
 *     onRowSelectionChange={sel.onRowSelectionChange}
 *     ...
 *   />
 */
export function buildSelectionColumn<T>(): ColumnDef<T, unknown> {
  return defineColumns<T>([
    {
      id: "__select",
      header: ({ table }) => {
        const all = table.getIsAllPageRowsSelected();
        const some = table.getIsSomePageRowsSelected();
        return (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
            <Checkbox
              checked={some ? "indeterminate" : all}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Seleccionar todas las filas visibles"
            />
          </div>
        );
      },
      meta: { width: "w-[40px]", align: "center", className: "p-0" },
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Seleccionar fila"
          />
        </div>
      ),
      enableSorting: false,
    },
  ])[0];
}
