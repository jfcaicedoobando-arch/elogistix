import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Power } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import type { OrgRow } from "@/hooks/admin";
import { toTitleCase } from "@/lib/formatters";

export function buildAdminOrganizacionesColumns(
  navigate: (path: string) => void,
): ColumnDef<OrgRow, unknown>[] {
  return defineColumns<OrgRow>([
    {
      id: "nombre",
      header: "Nombre",
      accessorFn: (o) => o.nombre,
      enableSorting: true,
      sortingFn: sortByString<OrgRow>((o) => o.nombre),
      meta: { width: "min-w-[200px]", className: "font-medium" },
      cell: ({ row }) => {
        const o = row.original;
        return (
          <button
            className="text-primary hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            onClick={() => navigate(`/admin/organizaciones/${o.id}`)}
            title={o.nombre}
          >
            {toTitleCase(o.nombre)}
          </button>
        );
      },
    },
    { id: "rfc", header: "RFC", meta: { width: "w-[140px]" }, cell: ({ row }) => row.original.rfc?.toUpperCase() || "—" },
    { id: "plan", header: "Plan", meta: { width: "w-[100px]" }, cell: ({ row }) => <Badge variant="outline">{row.original.plan}</Badge> },
    {
      id: "activo",
      header: "Estado",
      meta: { width: "w-[100px]" },
      cell: ({ row }) => (
        <Badge variant={row.original.activo ? "success" : "neutral"}>
          {row.original.activo ? "Activa" : "Inactiva"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      meta: { width: "w-[60px]", align: "right" },
      cell: ({ row }) => {
        const o = row.original;
        return (
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
        );
      },
    },
  ]);
}
