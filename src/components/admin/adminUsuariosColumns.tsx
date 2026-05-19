import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash2, ShieldOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import type { GlobalUserRow } from "@/hooks/admin";
import { getRoleLabel } from "@/lib/ui/uiMappings";

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-primary text-primary-foreground",
  admin: "bg-accent text-accent-foreground border border-primary/20",
  operador: "bg-info/15 text-info border border-info/30",
  viewer: "bg-muted text-muted-foreground border border-border",
  cliente: "bg-secondary text-secondary-foreground",
};

const initialsFor = (email: string) => email.slice(0, 2).toUpperCase();

export function buildAdminUsuariosColumns(
  onDelete: (u: GlobalUserRow) => void,
): ColumnDef<GlobalUserRow, unknown>[] {
  return defineColumns<GlobalUserRow>([
    {
      id: "email",
      header: "Usuario",
      accessorFn: (u) => u.email,
      enableSorting: true,
      sortingFn: sortByString<GlobalUserRow>((u) => u.email),
      meta: { width: "min-w-[260px]", className: "font-medium" },
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
              {initialsFor(u.email)}
            </div>
            <span className="truncate" title={u.email}>{u.email}</span>
          </div>
        );
      },
    },
    {
      id: "org",
      header: "Organización",
      accessorFn: (u) => u.org_nombre,
      enableSorting: true,
      sortingFn: sortByString<GlobalUserRow>((u) => u.org_nombre),
      meta: { width: "w-[200px]" },
      cell: ({ row }) => row.original.org_nombre,
    },
    {
      id: "role",
      header: "Rol",
      meta: { width: "w-[120px]" },
      cell: ({ row }) => (
        <Badge className={ROLE_BADGE[row.original.role] ?? ""} variant="outline">
          {getRoleLabel(row.original.role)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      meta: { width: "w-[60px]", align: "right" },
      cell: ({ row }) => {
        const u = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Acciones para ${u.email}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem disabled>
                <ShieldOff className="h-4 w-4 mr-2" /> Cambiar rol
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(u)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar usuario
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ]);
}
