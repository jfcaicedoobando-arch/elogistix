import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { statusColumn } from "@/components/shared/dataTable/columnBuilders";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import type { OrgRow } from "@/features/admin/hooks";
import { toTitleCase } from "@/lib/formatters";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

export function buildAdminOrganizacionesColumns(): ColumnDef<OrgRow, unknown>[] {
  return defineColumns<OrgRow>([
    {
      id: "nombre",
      header: "Nombre",
      accessorFn: (o) => o.nombre,
      enableSorting: true,
      sortingFn: sortByString<OrgRow>((o) => o.nombre),
      meta: { width: COL_W.texto, className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => toTitleCase(row.original.nombre),
    },
    { id: "rfc", header: "RFC", meta: { width: COL_W.monto, className: "font-mono text-xs" }, cell: ({ row }) => row.original.rfc?.toUpperCase() || "—" },
    { id: "plan", header: "Plan", meta: { width: COL_W.fecha }, cell: ({ row }) => <Badge variant="outline">{row.original.plan}</Badge> },
    {
      ...statusColumn<OrgRow>({
        id: "activo",
        header: "Estado",
        domain: "org",
        accessor: (o) => (o.activo ? "Activa" : "Inactiva"),
      }),
      meta: { width: COL_W.fecha },
    },
  ]);
}
