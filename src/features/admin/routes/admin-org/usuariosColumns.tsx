import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByDate } from "@/components/shared/dataTable/sortingFns";
import type { UserRow } from "@/features/admin/hooks/usuario";
import type { AppRole } from "@/types/appRole";
import { formatDate } from "@/lib/formatters";
import { ROLE_BADGE_CLASSES, ROLE_LABELS, ASSIGNABLE_ROLES_ADMIN_ORG, obtenerEtiquetaRol } from "@/features/admin/domain/roles/roleCatalog";

const roleBadge = ROLE_BADGE_CLASSES;

interface Options {
  currentUserId: string | undefined;
  onPendingRole: (user: UserRow, newRole: AppRole) => void;
  onDelete: (user: UserRow) => void;
}

export function useUsuarioColumns({ currentUserId, onPendingRole, onDelete }: Options) {
  return useMemo<ColumnDef<UserRow, unknown>[]>(() => defineColumns<UserRow>([
    {
      id: "email", header: "Email",
      accessorFn: (u) => u.email, enableSorting: true,
      sortingFn: sortByString<UserRow>((u) => u.email),
      meta: { width: "min-w-[200px]", className: "font-medium" },
      cell: ({ row }) => {
        const email = row.original.email;
        if (email === "No disponible") {
          return <span className="text-muted-foreground italic font-normal">{email}</span>;
        }
        return email;
      },
    },
    {
      id: "created_at", header: "Fecha de registro",
      accessorFn: (u) => u.created_at, enableSorting: true,
      sortingFn: sortByDate<UserRow>((u) => u.created_at),
      meta: { width: "w-[140px]", className: "text-xs text-muted-foreground" },
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: "role", header: "Rol actual",
      accessorFn: (u) => u.role, enableSorting: true,
      sortingFn: sortByString<UserRow>((u) => u.role),
      meta: { width: "w-[120px]" },
      cell: ({ row }) => <Badge className={roleBadge[row.original.role]}>{obtenerEtiquetaRol(row.original.role)}</Badge>,
    },
    {
      id: "change_role", header: "Cambiar rol", meta: { width: "w-[160px]" },
      cell: ({ row }) => {
        const u = row.original;
        return (
          <Select
            value={u.role}
            onValueChange={(val) => {
              const newRole = val as AppRole;
              if (newRole === u.role) return;
              onPendingRole(u, newRole);
            }}
          >
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES_ADMIN_ORG.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: "actions", header: "", meta: { width: "w-[50px]" },
      cell: ({ row }) => {
        const u = row.original;
        const isSelf = u.user_id === currentUserId;
        if (isSelf) return null;
        return (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(u); }}
            aria-label={`Eliminar usuario ${u.email}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        );
      },
    },
  ]), [currentUserId, onPendingRole, onDelete]);
}
