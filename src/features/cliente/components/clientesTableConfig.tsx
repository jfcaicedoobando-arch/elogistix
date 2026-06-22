import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
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

export const clientesColumns: ColumnDef<ClienteRow, unknown>[] = defineColumns<ClienteRow>([
  {
    id: "nombre",
    header: "Nombre",
    accessorFn: (c) => c.nombre,
    enableSorting: true,
    sortingFn: sortByString<ClienteRow>((c) => c.nombre),
    meta: { width: "min-w-[180px]", className: "font-medium max-w-[200px] truncate" },
    cell: ({ row }) => {
      const nombre = toTitleCase(row.original.nombre);
      return <span title={nombre}>{nombre}</span>;
    },
  },
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
]);

export function ClienteMobileCard({ c }: { c: ClienteRow }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="font-semibold text-sm truncate">{toTitleCase(c.nombre)}</div>
      <div className="text-[11px] font-mono text-muted-foreground truncate">
        {(c.rfc || "—").toUpperCase()}
      </div>
      {(c.ciudad || c.estado) && (
        <div className="text-[11px] text-muted-foreground truncate">
          {[correctSpanishPlace(c.ciudad), correctSpanishPlace(c.estado)]
            .filter(Boolean)
            .join(", ")}
        </div>
      )}
      {(c.contacto || c.telefono) && (
        <div className="text-[11px] text-muted-foreground truncate">
          {[toTitleCase(c.contacto), formatPhoneMx(c.telefono)].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}
