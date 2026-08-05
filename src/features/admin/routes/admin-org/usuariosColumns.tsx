import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByDate } from "@/components/shared/dataTable/sortingFns";
import type { Row, SortingFn } from "@tanstack/react-table";
import type { UserRow } from "@/features/admin/hooks/usuario";
import type { AppRole } from "@/types/appRole";
import { formatDate, formatDateTimeShort } from "@/lib/formatters";
import { obtenerRangoRol } from "@/features/admin/domain/roles/roleCatalog";
import { ChangeRoleCell, EstadoInvitacionCell, UsuarioCell } from "./usuariosCells";
import { UsuarioRowActionsCell, type UsuarioRowActions } from "./UsuarioRowActionsCell";
import { COL_W } from "@/components/shared/dataTable/columnWidths";


interface Options {
  currentUserId: string | undefined;
  onPendingRole: (user: UserRow, newRole: AppRole) => void;
  /** U-01: sólo se muestra la columna de organización cuando hay varias (super_admin). */
  mostrarOrganizacion?: boolean;
  acciones: UsuarioRowActions;
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

export function useUsuarioColumns({
  currentUserId,
  onPendingRole,
  mostrarOrganizacion = false,
  acciones,
}: Options) {
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
        ...(mostrarOrganizacion
          ? [
              {
                id: "organizacion",
                header: "Organización",
                accessorFn: (u: UserRow) => u.organizacion_nombre,
                enableSorting: true,
                meta: { width: COL_W.ruta },
                cell: ({ row }: { row: Row<UserRow> }) => (
                  <Badge variant="outline" className="font-normal">
                    {row.original.organizacion_nombre}
                  </Badge>
                ),
              },
            ]
          : []),
        {
          id: "role",
          header: "Rol",
          accessorFn: (u) => u.role,
          enableSorting: true,
          sortingFn: sortByRoleHierarchy,
          meta: { width: COL_W.texto },
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
          meta: { width: COL_W.micro },
          cell: ({ row }) => {
            const u = row.original;
            if (u.user_id === currentUserId) return null;
            return <UsuarioRowActionsCell user={u} acciones={acciones} />;
          },
        },
      ]),
    [currentUserId, onPendingRole, mostrarOrganizacion, acciones],
  );
}
