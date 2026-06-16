import { Plus, MoreHorizontal, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CotizacionesPageActionsProps {
  canEdit: boolean;
  onExportar: () => void;
  onNueva: () => void;
}

export function CotizacionesPageActions({
  canEdit,
  onExportar,
  onNueva,
}: CotizacionesPageActionsProps) {
  return (
    <>
      <Button variant="outline" onClick={onExportar} className="hidden sm:inline-flex">
        <Download className="h-4 w-4 mr-2" /> Exportar CSV
      </Button>
      {canEdit && (
        <Button onClick={onNueva} className="hidden sm:inline-flex">
          <Plus className="h-4 w-4 mr-2" /> Nueva Cotización
        </Button>
      )}
      {canEdit && (
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/cotizaciones/nueva/tarifario")}
          className="hidden sm:inline-flex"
        >
          <Plus className="h-4 w-4 mr-2" /> Nuevo Tarifario
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="sm:hidden" aria-label="Más acciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onExportar}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
