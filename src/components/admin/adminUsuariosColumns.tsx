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
import type { DataTableColumn } from "@/components/shared/DataTable";
import type { GlobalUserRow } from "@/hooks/admin/useAdminData";
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
): DataTableColumn<GlobalUserRow>[] {
  return [
    {
      key: "email",
      header: "Usuario",
      width: "min-w-[260px]",
      className: "font-medium",
      sortable: true,
      sortValue: (u) => u.email,
      render: (u) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
            {initialsFor(u.email)}
          </div>
          <span className="truncate" title={u.email}>{u.email}</span>
        </div>
      ),
    },
    {
      key: "org",
      header: "Organización",
      width: "w-[200px]",
      sortable: true,
      sortValue: (u) => u.org_nombre,
      render: (u) => u.org_nombre,
    },
    {
      key: "role",
      header: "Rol",
      width: "w-[120px]",
      render: (u) => (
        <Badge className={ROLE_BADGE[u.role] ?? ""} variant="outline">
          {getRoleLabel(u.role)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-[60px]",
      align: "right",
      render: (u) => (
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
      ),
    },
  ];
}
