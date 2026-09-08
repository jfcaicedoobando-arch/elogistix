import { StatusBadge } from "@/components/shared/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { toTitleCase } from "@/lib/formatters";
import { type CrmLeadRow } from "@/features/crm/hooks";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

export function makeLeadsColumns(
  selected: Set<string>,
  toggle: (id: string) => void,
  toggleAll: (rows: CrmLeadRow[]) => void,
  allRows: CrmLeadRow[],
  permisos: {
    puedeSeleccionar: boolean;
  },
): ColumnDef<CrmLeadRow, unknown>[] {
  const { puedeSeleccionar } = permisos;
  const allSelected = allRows.length > 0 && allRows.every((r) => selected.has(r.id));
  const columnaSeleccion: ColumnDef<CrmLeadRow, unknown> = {
      id: "sel", header: () => (
        <Checkbox checked={allSelected} onCheckedChange={() => toggleAll(allRows)} aria-label="Seleccionar todos" />
      ),
      meta: { width: COL_W.micro },
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(row.original.id)} onCheckedChange={() => toggle(row.original.id)} />
        </div>
      ),
    };
  return defineColumns<CrmLeadRow>([
    ...(puedeSeleccionar ? [columnaSeleccion] : []),
    {
      id: "empresa", header: "Empresa",
      accessorFn: (l) => l.empresa, enableSorting: true,
      sortingFn: sortByString<CrmLeadRow>((l) => l.empresa),
      meta: { width: COL_W.ruta, className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => toTitleCase(row.original.empresa),
    },
    { id: "contacto", header: "Contacto", meta: { width: COL_W.nombre, className: "text-body-sm" }, cell: ({ row }) => toTitleCase(row.original.contacto ?? "") },
    { id: "email", header: "Correo", meta: { width: COL_W.texto, className: "text-body-sm truncate hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" }, cell: ({ row }) => row.original.email ?? "" },
    { id: "fuente", header: "Origen", meta: { width: COL_W.folio, className: "text-body-sm hidden xl:table-cell", headerClassName: "hidden xl:table-cell" }, cell: ({ row }) => row.original.fuente },
    {
      // v13.823.227: el estado sólo se edita en el detalle del lead; aquí es lectura.
      id: "estado", header: "Estado", meta: { width: COL_W.nombre },
      cell: ({ row }) => <StatusBadge domain="lead" status={row.original.estado} />,
    },
    { id: "score", header: "Score", meta: { width: COL_W.tiny, align: "center", className: "text-center text-body-sm tabular-nums" }, cell: ({ row }) => row.original.score },
  ]);
}
