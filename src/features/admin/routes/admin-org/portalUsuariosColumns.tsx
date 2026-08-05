import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByDate } from "@/components/shared/dataTable/sortingFns";
import { formatDate, formatDateTimeShort } from "@/lib/formatters";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario";
import type {
import { COL_W } from "@/components/shared/dataTable/columnWidths";
  PortalAgenteUserRow,
  PortalClienteUserRow,
} from "@/features/admin/services/usuario/portales";

export type PortalUserRow = PortalClienteUserRow | PortalAgenteUserRow;

interface Options<T extends PortalUserRow> {
  tipo: "cliente" | "agente";
  onDelete: (user: T) => void;
}

function vinculadoLabel(tipo: "cliente" | "agente") {
  return tipo === "cliente" ? "Cliente" : "Agente";
}

function getVinculadoNombre(row: PortalUserRow, tipo: "cliente" | "agente") {
  return tipo === "cliente"
    ? (row as PortalClienteUserRow).cliente_nombre
    : (row as PortalAgenteUserRow).agente_nombre;
}

export function usePortalUsuarioColumns<T extends PortalUserRow>({
  tipo,
  onDelete,
}: Options<T>) {
  return useMemo<ColumnDef<T, unknown>[]>(
    () =>
      defineColumns<T>([
        {
          id: "email",
          header: "Email",
          accessorFn: (u) => u.email,
          enableSorting: true,
          sortingFn: (a, b) =>
            (a.original.email ?? "").localeCompare(b.original.email ?? "", "es-MX", {
              sensitivity: "base",
            }),
          meta: { width: "w-[360px] min-w-[280px]" },
          cell: ({ row }) => {
            const email = row.original.email;
            const unresolved = email === UNRESOLVED_EMAIL;
            return (
              <span
                className={
                  unresolved ? "text-muted-foreground italic" : "font-medium"
                }
              >
                {email}
              </span>
            );
          },
        },
        {
          id: "vinculado",
          header: vinculadoLabel(tipo),
          accessorFn: (u) => getVinculadoNombre(u, tipo),
          enableSorting: true,
          sortingFn: (a, b) =>
            getVinculadoNombre(a.original, tipo).localeCompare(
              getVinculadoNombre(b.original, tipo),
              "es-MX",
              { sensitivity: "base" },
            ),
          meta: { width: COL_W.texto },
          cell: ({ row }) => (
            <span className="text-sm">{getVinculadoNombre(row.original, tipo)}</span>
          ),
        },
        {
          id: "created_at",
          header: () => <span className="whitespace-nowrap">Fecha de alta</span>,
          accessorFn: (u) => u.created_at,
          enableSorting: true,
          sortingFn: sortByDate<T>((u) => u.created_at),
          meta: {
            width: "w-[1%] whitespace-nowrap",
            className: "text-xs text-muted-foreground whitespace-nowrap",
          },
          cell: ({ row }) => (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">{formatDate(row.original.created_at)}</span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{formatDateTimeShort(row.original.created_at)}</p>
              </TooltipContent>
            </Tooltip>
          ),
        },
        {
          id: "actions",
          header: "",
          meta: { width: COL_W.micro },
          cell: ({ row }) => (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(row.original);
                  }}
                  aria-label={`Eliminar usuario ${row.original.email}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs">Eliminar usuario</p>
              </TooltipContent>
            </Tooltip>
          ),
        },
      ]),
    [tipo, onDelete],
  );
}
