/**
 * clientesTableConfig — columnas de la tabla de clientes.
 * Usa los column builders compartidos.
 *
 * v13.172.16: se elimina el `actionsColumn` "Ver detalle" porque duplica la
 * navegación de fila (`onRowClick` en `Clientes.tsx` ya va a `/clientes/:id`).
 */
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import type { ColumnDef } from "@tanstack/react-table";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { toTitleCase, formatPhoneMx, correctSpanishPlace, formatCurrency } from "@/lib/formatters";
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
      meta: { width: COL_W.texto, className: "font-medium", sticky: true },
      cell: ({ row }) => {
        const nombre = toTitleCase(row.original.nombre ?? "");
        const limite = row.original.limite_credito_mxn ?? null;
        const saldo = Number(row.original.saldo_pendiente_mxn ?? 0);
        const excedido = limite != null && limite > 0 && saldo > limite;
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="block whitespace-normal break-words leading-snug truncate" title={nombre}>
              {nombre}
            </span>
            {excedido && (
              <Badge variant="destructive" className="shrink-0 text-2xs px-1.5 py-0">
                Crédito excedido
              </Badge>
            )}
          </div>
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
      meta: { width: COL_W.folio, className: "text-xs font-mono hidden md:table-cell", headerClassName: "hidden md:table-cell" },
      cell: ({ row }) => (row.original.rfc || "").toUpperCase(),
    },
    {
      id: "ciudad",
      header: "Ciudad",
      accessorFn: (c) => c.ciudad,
      enableSorting: true,
      sortingFn: sortByString<ClienteRow>((c) => c.ciudad),
      meta: { width: COL_W.nombre, className: "text-xs" },
      cell: ({ row }) => {
        const ciudad = correctSpanishPlace(row.original.ciudad);
        const estado = correctSpanishPlace(row.original.estado);
        if (!ciudad && !estado) return <span className="text-muted-foreground">—</span>;
        return [ciudad, estado].filter(Boolean).join(", ");
      },
    },
    {
      id: "por_cobrar",
      header: "Por cobrar",
      accessorFn: (c) => Number(c.saldo_pendiente_mxn ?? 0),
      enableSorting: true,
      meta: {
        width: COL_W.estado,
        className: "text-xs text-right tabular-nums whitespace-nowrap",
        headerClassName: "text-right",
      },
      cell: ({ row }) => {
        const saldo = Number(row.original.saldo_pendiente_mxn ?? 0);
        const limite = row.original.limite_credito_mxn ?? null;
        const excedido = limite != null && limite > 0 && saldo > limite;
        if (saldo <= 0.01) return <span className="text-muted-foreground">—</span>;
        return (
          <span
            className={excedido ? "font-semibold text-destructive" : "font-medium"}
            title={limite && limite > 0 ? `Límite de crédito: ${formatCurrency(limite, "MXN")}` : undefined}
          >
            {formatCurrency(saldo, "MXN")}
          </span>
        );
      },
    },
    {
      id: "contacto",
      header: "Contacto",
      // Oculto en tableta (<xl) para evitar overflow horizontal.
      meta: { width: COL_W.nombre, className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => {
        const v = toTitleCase(row.original.contacto);
        return v ? v : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: "telefono",
      header: "Teléfono",
      meta: { width: COL_W.fecha, className: "text-xs whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => {
        const v = formatPhoneMx(row.original.telefono);
        return v ? v : <span className="text-muted-foreground">—</span>;
      },
    },
  ];
}
