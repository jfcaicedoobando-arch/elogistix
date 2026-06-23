import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByDate } from "@/components/shared/dataTable/sortingFns";
import type { Row, SortingFn } from "@tanstack/react-table";
import type { UserRow } from "@/features/admin/hooks/usuario";
import type { AppRole } from "@/types/appRole";
import { formatDate, formatDateTimeShort } from "@/lib/formatters";
import {
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ASSIGNABLE_ROLE_GROUPS,
  obtenerEtiquetaRol,
  obtenerRangoRol,
} from "@/features/admin/domain/roles/roleCatalog";

const roleBadge = ROLE_BADGE_CLASSES;

interface Options {
  currentUserId: string | undefined;
  onPendingRole: (user: UserRow, newRole: AppRole) => void;
  onDelete: (user: UserRow) => void;
}

/** Iniciales (2 chars) a partir del email. Fallback: "?". */
function inicialesDeEmail(email: string): string {
  if (!email || email === "No disponible") return "?";
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
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
          sortingFn: (a, b) => {
            const ea = a.original.email ?? "";
            const eb = b.original.email ?? "";
            return ea.localeCompare(eb, "es-MX", { sensitivity: "base" });
          },
          meta: { width: "w-auto min-w-[240px] max-w-[480px]" },
          cell: ({ row }) => {
            const u = row.original;
            const isSelf = u.user_id === currentUserId;
            const unresolved = u.email === "No disponible";
            return (
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0 md:h-9 md:w-9">
                  <AvatarFallback className="bg-muted text-[11px] font-semibold text-muted-foreground">
                    {inicialesDeEmail(u.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span
                    className={
                      unresolved
                        ? "italic font-normal text-muted-foreground truncate"
                        : "font-medium truncate"
                    }
                  >
                    {u.email}
                  </span>
                  {isSelf && (
                    <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">
                      Tú
                    </span>
                  )}
                </div>
              </div>
            );
          },
        },
        {
          id: "role",
          header: "Rol",
          accessorFn: (u) => u.role,
          enableSorting: true,
          sortingFn: sortByRoleHierarchy,
          meta: { width: "w-[1%] whitespace-nowrap" },
          cell: ({ row }) => {
            const role = row.original.role;
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={`${roleBadge[role]} cursor-help whitespace-nowrap`}>
                    {obtenerEtiquetaRol(role)}
                  </Badge>
                </TooltipTrigger>

                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs leading-snug">{ROLE_DESCRIPTIONS[role]}</p>
                </TooltipContent>
              </Tooltip>
            );
          },
        },
        {
          id: "created_at",
          header: () => <span className="whitespace-nowrap">Fecha de registro</span>,
          accessorFn: (u) => u.created_at,
          enableSorting: true,
          sortingFn: sortByDate<UserRow>((u) => u.created_at),
          meta: { width: "w-[170px]", className: "text-xs text-muted-foreground whitespace-nowrap" },
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
          id: "change_role",
          header: "Cambiar rol",
          meta: { width: "w-[240px]" },
          cell: ({ row }) => {
            const u = row.original;
            const isSelf = u.user_id === currentUserId;
            return (
              <Select
                value={u.role}
                disabled={isSelf}
                onValueChange={(val) => {
                  const newRole = val as AppRole;
                  if (newRole === u.role) return;
                  onPendingRole(u, newRole);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>

                  {ASSIGNABLE_ROLE_GROUPS.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </SelectLabel>
                      {group.roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            );
          },
        },
        {
          id: "actions",
          header: "",
          meta: { width: "w-[50px]" },
          cell: ({ row }) => {
            const u = row.original;
            const isSelf = u.user_id === currentUserId;
            if (isSelf) return null;
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
