import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { Badge } from "@/components/ui/badge";
import type { ProveedorListItem } from "@/features/proveedor/hooks";
import { toTitleCase } from "@/lib/formatters";
import { labelSubtipoGasto } from "@/constants/proveedorConstants";

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

function ClasificacionCell({ row }: { row: { original: ProveedorListItem } }) {
  const p = row.original;
  if (p.categoria === "GastoOperativo") {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 w-fit">
          Gasto de administración
        </Badge>
        <span className="text-xs text-muted-foreground">{labelSubtipoGasto(p.subtipo_gasto)}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant="outline" className="bg-muted text-foreground border-border w-fit">
        Logístico
      </Badge>
      <span className="text-xs text-muted-foreground">{p.tipo ?? "—"}</span>
    </div>
  );
}

export const proveedorColumns: ColumnDef<ProveedorListItem, unknown>[] = defineColumns<ProveedorListItem>([
  { id: "nombre", header: "Nombre", accessorFn: (p) => p.nombre, enableSorting: true, sortingFn: sortByString<ProveedorListItem>((p) => p.nombre), meta: { width: "min-w-[180px]", className: "font-medium" }, cell: ({ row }) => <span title={row.original.nombre}>{toTitleCase(row.original.nombre)}</span> },
  { id: "clasificacion", header: "Clasificación", meta: { width: "w-[180px]" }, cell: ClasificacionCell },
  { id: "origen", header: "Origen", meta: { width: "w-[110px]" }, cell: ({ row }) => <OrigenBadge origen={row.original.origen_proveedor} /> },
  { id: "rfc", header: "RFC / Tax ID", accessorFn: (p) => p.rfc, enableSorting: true, sortingFn: sortByString<ProveedorListItem>((p) => p.rfc), meta: { width: "w-[140px]", className: "text-xs font-mono" }, cell: ({ row }) => row.original.rfc },
  { id: "contacto", header: "Contacto", meta: { width: "w-[140px]", className: "text-xs" }, cell: ({ row }) => row.original.contacto ? <span title={row.original.contacto}>{toTitleCase(row.original.contacto)}</span> : null },
  { id: "moneda", header: "Moneda", meta: { width: "w-[80px]", className: "text-xs" }, cell: ({ row }) => row.original.moneda_preferida },
]);
