import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { toTitleCase } from "@/lib/formatters";
import type { CrmLeadEstado, CrmLeadRow } from "@/hooks/crm";

const ESTADO_VARIANT: Record<CrmLeadEstado, "default" | "secondary" | "outline" | "destructive"> = {
  Nuevo: "default",
  Contactado: "secondary",
  Calificado: "default",
  Descalificado: "destructive",
  Convertido: "outline",
};

export function makeLeadsColumns(
  selected: Set<string>,
  toggle: (id: string) => void,
  toggleAll: (rows: CrmLeadRow[]) => void,
  allRows: CrmLeadRow[],
): ColumnDef<CrmLeadRow, unknown>[] {
  const allSelected = allRows.length > 0 && allRows.every((r) => selected.has(r.id));
  return defineColumns<CrmLeadRow>([
    {
      id: "sel", header: () => (
        <Checkbox checked={allSelected} onCheckedChange={() => toggleAll(allRows)} aria-label="Seleccionar todos" />
      ),
      meta: { width: "w-[40px]" },
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(row.original.id)} onCheckedChange={() => toggle(row.original.id)} />
        </div>
      ),
    },
    {
      id: "empresa", header: "Empresa",
      accessorFn: (l) => l.empresa, enableSorting: true,
      sortingFn: sortByString<CrmLeadRow>((l) => l.empresa),
      meta: { width: "min-w-[180px]", className: "font-medium" },
      cell: ({ row }) => toTitleCase(row.original.empresa),
    },
    { id: "contacto", header: "Contacto", meta: { width: "w-[160px]", className: "text-xs" }, cell: ({ row }) => toTitleCase(row.original.contacto ?? "") },
    { id: "email", header: "Email", meta: { width: "w-[200px]", className: "text-xs truncate" }, cell: ({ row }) => row.original.email ?? "" },
    { id: "fuente", header: "Fuente", meta: { width: "w-[120px]", className: "text-xs" }, cell: ({ row }) => row.original.fuente },
    {
      id: "estado", header: "Estado", meta: { width: "w-[120px]" },
      cell: ({ row }) => <Badge variant={ESTADO_VARIANT[row.original.estado]}>{row.original.estado}</Badge>,
    },
    { id: "score", header: "Score", meta: { width: "w-[60px]", className: "text-center text-xs" }, cell: ({ row }) => row.original.score },
  ]);
}
