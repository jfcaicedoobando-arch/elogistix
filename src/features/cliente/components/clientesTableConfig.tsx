/**
 * clientesTableConfig — columnas de la tabla de clientes.
 * Usa los column builders compartidos.
 *
 * v13.172.16: se elimina el `actionsColumn` "Ver detalle" porque duplica la
 * navegación de fila (`onRowClick` en `Clientes.tsx` ya va a `/clientes/:id`).
 */
import type { ColumnDef } from "@tanstack/react-table";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { toTitleCase, formatPhoneMx, correctSpanishPlace } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";

export type ClienteRow = {
  id: string;
  nombre: string;
  rfc: string;
  ciudad: string;
  estado: string;
  contacto: string;
  telefono: string;
  limite_credito_mxn?: number | null;
  saldo_pendiente_mxn?: number | null;
};

export function buildClientesColumns(): ColumnDef<ClienteRow, unknown>[] {
  return [
    {
      id: "nombre",
      header: "Nombre",
      accessorFn: (c) => c.nombre,
      enableSorting: true,
      sortingFn: sortByString<ClienteRow>((c) => c.nombre),
      meta: { width: "min-w-[240px]", className: "font-medium", sticky: true },
      cell: ({ row }) => {
        const nombre = toTitleCase(row.original.nombre ?? "");
        return (
          <span className="block whitespace-normal break-words leading-snug" title={nombre}>
            {nombre}
          </span>
        );
      },
    },
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
      cell: ({ row }) => {
        const ciudad = correctSpanishPlace(row.original.ciudad);
        const estado = correctSpanishPlace(row.original.estado);
        if (!ciudad && !estado) return <span className="text-muted-foreground">—</span>;
        return [ciudad, estado].filter(Boolean).join(", ");
      },
    },
    {
      id: "contacto",
      header: "Contacto",
      // Oculto en tableta (<xl) para evitar overflow horizontal.
      meta: { width: "w-[140px]", className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => {
        const v = toTitleCase(row.original.contacto);
        return v ? v : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: "telefono",
      header: "Teléfono",
      meta: { width: "w-[130px]", className: "text-xs whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => {
        const v = formatPhoneMx(row.original.telefono);
        return v ? v : <span className="text-muted-foreground">—</span>;
      },
    },
  ];
}
