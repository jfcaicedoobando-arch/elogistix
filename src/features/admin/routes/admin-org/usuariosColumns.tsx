import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByDate } from "@/components/shared/dataTable/sortingFns";
import type { Row, SortingFn } from "@tanstack/react-table";
import type { UserRow } from "@/features/admin/hooks/usuario";
import type { AppRole } from "@/types/appRole";
import { formatDate, formatDateTimeShort } from "@/lib/formatters";
import { obtenerRangoRol } from "@/features/admin/domain/roles/roleCatalog";
import { ChangeRoleCell, EstadoInvitacionCell, UsuarioCell } from "./usuariosCells";


interface Options {
  currentUserId: string | undefined;
  onPendingRole: (user: UserRow, newRole: AppRole) => void;
  onDelete: (user: UserRow) => void;
}

/** Sort por jerarquía de rol; empate → email asc. */
const sortByRoleHierarchy: SortingFn<UserRow> = (a: Row<UserRow>, b: Row<UserRow>) => {
  const ra = obtenerRangoRol(a.original.role);
  const rb = obtenerRangoRol(b.original.role);
  if (ra !== rb) return ra - rb;
  const ea = a.original.email ?? "";
  const eb = b.original.email ?? "";
  return ea.localeCompare(eb, "es-MX", { sensitivity: "base" });
};

export function useUsuarioColumns({ currentUserId, onPendingRole, onDelete }: Options) {
  return useMemo<ColumnDef<UserRow, unknown>[]>(
    () =>
      defineColumns<UserRow>([
        {
          id: "usuario",
          header: "Usuario",
          accessorFn: (u) => u.email,
          enableSorting: true,
          sortingFn: (a, b) =>
            (a.original.email ?? "").localeCompare(b.original.email ?? "", "es-MX", {
              sensitivity: "base",
            }),
          meta: { width: "w-[360px] min-w-[280px]" },
          cell: ({ row }) => (
            <UsuarioCell user={row.original} isSelf={row.original.user_id === currentUserId} />
          ),
        },
        {
          id: "role",
          header: "Rol",
          accessorFn: (u) => u.role,
          enableSorting: true,
          sortingFn: sortByRoleHierarchy,
          meta: { width: "w-[260px]" },
          cell: ({ row }) => (
            <ChangeRoleCell
              user={row.original}
              isSelf={row.original.user_id === currentUserId}
              onPendingRole={onPendingRole}
            />
          ),
        },
        {
          id: "estado",
          header: "Estado",
          accessorFn: (u) => u.estado,
          enableSorting: true,
          meta: { width: "w-[1%] whitespace-nowrap" },
          cell: ({ row }) => <EstadoInvitacionCell estado={row.original.estado} />,
        },
        {
          id: "created_at",
          header: () => <span className="whitespace-nowrap">Fecha de registro</span>,
          accessorFn: (u) => u.created_at,
          enableSorting: true,
          sortingFn: sortByDate<UserRow>((u) => u.created_at),
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
          meta: { width: "w-[50px]" },
          cell: ({ row }) => {
            const u = row.original;
            if (u.user_id === currentUserId) return null;
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(u);
                    }}
                    aria-label={`Eliminar usuario ${u.email}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">Eliminar usuario</p>
                </TooltipContent>
              </Tooltip>
            );
          },
        },
      ]),
    [currentUserId, onPendingRole, onDelete],
  );
}
