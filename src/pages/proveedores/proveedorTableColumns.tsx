import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import type { ProveedorListItem } from "@/hooks/proveedor";
import { toTitleCase } from "@/lib/formatters";

export const proveedorColumns: ColumnDef<ProveedorListItem, unknown>[] = defineColumns<ProveedorListItem>([
  { id: "nombre", header: "Nombre", accessorFn: (p) => p.nombre, enableSorting: true, sortingFn: sortByString<ProveedorListItem>((p) => p.nombre), meta: { width: "min-w-[180px]", className: "font-medium" }, cell: ({ row }) => <span title={row.original.nombre}>{toTitleCase(row.original.nombre)}</span> },
  { id: "rfc", header: "RFC", accessorFn: (p) => p.rfc, enableSorting: true, sortingFn: sortByString<ProveedorListItem>((p) => p.rfc), meta: { width: "w-[130px]", className: "text-xs font-mono" }, cell: ({ row }) => row.original.rfc },
  { id: "contacto", header: "Contacto", meta: { width: "w-[140px]", className: "text-xs" }, cell: ({ row }) => row.original.contacto ? <span title={row.original.contacto}>{toTitleCase(row.original.contacto)}</span> : null },
  { id: "moneda", header: "Moneda", meta: { width: "w-[80px]", className: "text-xs" }, cell: ({ row }) => row.original.moneda_preferida },
]);
