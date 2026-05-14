import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Power } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableColumn } from "@/components/shared/DataTable";
import type { OrgRow } from "@/hooks/admin/useAdminData";
import { toTitleCase } from "@/lib/formatters";

export function buildAdminOrganizacionesColumns(
  navigate: (path: string) => void,
): DataTableColumn<OrgRow>[] {
  return [
    {
      key: "nombre",
      header: "Nombre",
      width: "min-w-[200px]",
      className: "font-medium",
      sortable: true,
      sortValue: (o) => o.nombre,
      render: (o) => (
        <button
          className="text-primary hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          onClick={() => navigate(`/admin/organizaciones/${o.id}`)}
          title={o.nombre}
        >
          {toTitleCase(o.nombre)}
        </button>
      ),
    },
    { key: "rfc", header: "RFC", width: "w-[140px]", render: (o) => o.rfc?.toUpperCase() || "—" },
    { key: "plan", header: "Plan", width: "w-[100px]", render: (o) => <Badge variant="outline">{o.plan}</Badge> },
    {
      key: "activo",
      header: "Estado",
      width: "w-[100px]",
      render: (o) => (
        <Badge variant={o.activo ? "success" : "neutral"}>
          {o.activo ? "Activa" : "Inactiva"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-[60px]",
      align: "right",
      render: (o) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Acciones para ${o.nombre}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => navigate(`/admin/organizaciones/${o.id}`)}>
              <Eye className="h-4 w-4 mr-2" /> Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Power className="h-4 w-4 mr-2" /> {o.activo ? "Desactivar" : "Activar"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
