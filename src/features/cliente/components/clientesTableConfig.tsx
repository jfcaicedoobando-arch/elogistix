/**
 * clientesTableConfig — columnas de la tabla de clientes.
 * Usa los column builders de Oleada 1.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import {
  clientColumn,
  actionsColumn,
} from "@/components/shared/dataTable/columnBuilders";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { toTitleCase, formatPhoneMx, correctSpanishPlace } from "@/lib/formatters";

export type ClienteRow = {
  id: string;
  nombre: string;
  rfc: string;
  ciudad: string;
  estado: string;
  contacto: string;
  telefono: string;
};

interface BuildClientesColumnsOpts {
  onNavigate: (id: string) => void;
}

export function buildClientesColumns({
  onNavigate,
}: BuildClientesColumnsOpts): ColumnDef<ClienteRow, unknown>[] {
  return [
    {
      ...clientColumn<ClienteRow>({ id: "nombre", header: "Nombre", accessor: (c) => c.nombre }),
      sortingFn: sortByString<ClienteRow>((c) => c.nombre),
      meta: { width: "min-w-[180px]", className: "max-w-[200px]" },
    } as ColumnDef<ClienteRow, unknown>,
    {
      id: "rfc",
      header: "RFC",
      accessorFn: (c) => c.rfc,
      enableSorting: true,
      sortingFn: sortByString<ClienteRow>((c) => c.rfc),
      meta: { width: "w-[130px]", className: "text-xs font-mono" },
      cell: ({ row }) => (row.original.rfc || "").toUpperCase(),
    },
    {
      id: "ciudad",
      header: "Ciudad",
      accessorFn: (c) => c.ciudad,
      enableSorting: true,
      sortingFn: sortByString<ClienteRow>((c) => c.ciudad),
      meta: { width: "w-[150px]", className: "text-xs" },
      cell: ({ row }) =>
        `${correctSpanishPlace(row.original.ciudad)}, ${correctSpanishPlace(row.original.estado)}`,
    },
    {
      id: "contacto",
      header: "Contacto",
      meta: { width: "w-[140px]", className: "text-xs" },
      cell: ({ row }) => toTitleCase(row.original.contacto),
    },
    {
      id: "telefono",
      header: "Teléfono",
      meta: { width: "w-[130px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => formatPhoneMx(row.original.telefono),
    },
    actionsColumn<ClienteRow>({
      items: () => [
        {
          label: "Ver detalle",
          icon: <Eye className="h-4 w-4" />,
          onSelect: (r) => onNavigate(r.id),
        },
      ],
    }),
  ];
}
