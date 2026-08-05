import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { Badge } from "@/components/ui/badge";
import type { ProveedorListItem } from "@/features/proveedor/hooks";
import { toTitleCase } from "@/lib/formatters";
import { decodeHtmlEntities } from "@/lib/formatters/decodeHtmlEntities";

function OrigenBadge({ origen }: { origen: ProveedorListItem["origen_proveedor"] }) {
  if (!origen) return <span className="text-muted-foreground text-xs">—</span>;
  const cls =
    origen === "Nacional"
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-warning/10 text-warning border-warning/20";
  return (
    <Badge variant="outline" className={cls}>
      {origen}
    </Badge>
  );
}

export const proveedorColumns: ColumnDef<ProveedorListItem, unknown>[] = defineColumns<ProveedorListItem>([
  {
    id: "nombre",
    header: "Nombre",
    accessorFn: (p) => p.nombre,
    enableSorting: true,
    sortingFn: sortByString<ProveedorListItem>((p) => p.nombre),
    meta: { width: COL_W.texto, className: "max-w-[280px] font-medium" },
    cell: ({ row }) => {
      const nombre = toTitleCase(row.original.nombre ?? "");
      return (
        <span className="block whitespace-normal break-words leading-snug truncate" title={nombre}>
          {nombre}
        </span>
      );
    },
  },
  { id: "tipo", header: "Tipo", meta: { width: COL_W.estado }, cell: ({ row }) => <span className="text-sm">{row.original.tipo ?? "—"}</span> },
  { id: "origen", header: "Origen", meta: { width: COL_W.short, className: "hidden xl:table-cell", headerClassName: "hidden xl:table-cell" }, cell: ({ row }) => <OrigenBadge origen={row.original.origen_proveedor} /> },
  { id: "rfc", header: "RFC / Tax ID", accessorFn: (p) => decodeHtmlEntities(p.rfc), enableSorting: true, sortingFn: sortByString<ProveedorListItem>((p) => decodeHtmlEntities(p.rfc)), meta: { width: COL_W.folio, className: "text-xs font-mono hidden md:table-cell", headerClassName: "hidden md:table-cell" }, cell: ({ row }) => decodeHtmlEntities(row.original.rfc) },
  { id: "contacto", header: "Contacto", meta: { width: COL_W.nombre, className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" }, cell: ({ row }) => row.original.contacto ? <span title={row.original.contacto}>{toTitleCase(row.original.contacto)}</span> : null },
  { id: "moneda", header: "Moneda", meta: { width: COL_W.tiny, className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" }, cell: ({ row }) => row.original.moneda_preferida },
]);
