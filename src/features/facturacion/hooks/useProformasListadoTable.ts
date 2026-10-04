import type { ColumnDef } from "@/components/shared/DataTable";
import { useTableInstance } from "@/components/shared/dataTable/useTableInstance";
import type { SortDir } from "@/components/shared/dataTable/types";
import type { ProformaConFactura } from "@/features/embarques/hooks";

/** TanStack ordena todos los resultados filtrados antes de paginarlos. */
export function useProformasListadoTable(args: {
  data: ProformaConFactura[];
  columns: ColumnDef<ProformaConFactura, unknown>[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const table = useTableInstance({
    data: args.data,
    columns: args.columns,
    sortMode: "client",
    getRowId: (row) => row.id,
  });
  const orden = table.getState().sorting[0];
  return {
    data: table.getRowModel().rows
      .slice(args.page * args.pageSize, (args.page + 1) * args.pageSize)
      .map((row) => row.original),
    controlledSort: { key: orden?.id ?? null, dir: orden?.desc ? "desc" as const : "asc" as const },
    onSortChange: (key: string | null, dir: SortDir) => {
      table.setSorting(key ? [{ id: key, desc: dir === "desc" }] : []);
      args.onPageChange(0);
    },
  };
}
