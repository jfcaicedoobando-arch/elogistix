/**
 * clientesTableConfig — columnas de la tabla de clientes.
 * Usa los column builders compartidos.
 *
 * v13.172.16: se elimina el `actionsColumn` "Ver detalle" porque duplica la
 * navegación de fila (`onRowClick` en `Clientes.tsx` ya va a `/clientes/:id`).
 */
import type { ColumnDef } from "@tanstack/react-table";
import { clientColumn } from "@/components/shared/dataTable/columnBuilders";
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

export function buildClientesColumns(): ColumnDef<ClienteRow, unknown>[] {
  return [
    {
      ...clientColumn<ClienteRow>({ id: "nombre", header: "Nombre", accessor: (c) => c.nombre }),
      sortingFn: sortByString<ClienteRow>((c) => c.nombre),
      meta: { width: "min-w-[180px]", className: "max-w-[200px]", sticky: true },
    } as ColumnDef<ClienteRow, unknown>,
    {
      id: "rfc",
      header: "RFC",
      accessorFn: (c) => c.rfc,
      enableSorting: true,
      sortingFn: sortByString<ClienteRow>((c) => c.rfc),
      // Se oculta en <md porque en móvil ya se muestra en la mobile card.
      meta: { width: "w-[130px]", className: "text-xs font-mono hidden md:table-cell", headerClassName: "hidden md:table-cell" },
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
      // Oculto en tableta (<xl) para evitar overflow horizontal.
      meta: { width: "w-[140px]", className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => toTitleCase(row.original.contacto),
    },
    {
      id: "telefono",
      header: "Teléfono",
      meta: { width: "w-[130px]", className: "text-xs whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => formatPhoneMx(row.original.telefono),
    },
  ];
}
