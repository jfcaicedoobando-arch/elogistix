import { Plus, MoreHorizontal, Download, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CotizacionesPageActionsProps {
  canEdit: boolean;
  /** Total filtrado en servidor: con 0 no hay nada que exportar. */
  totalFiltrado?: number;
  onExportar: () => void;
  onNueva: () => void;
}

export function CotizacionesPageActions({
  canEdit,
  totalFiltrado,
  onExportar,
  onNueva,
}: CotizacionesPageActionsProps) {
  return (
    <>
      <Button variant="outline" asChild className="hidden md:inline-flex">
        <Link to="/cotizaciones/plantillas">
          <Sparkles className="h-4 w-4 mr-2" /> Plantillas
        </Link>
      </Button>
      <Hint label={totalFiltrado === 0 ? "No hay cotizaciones que exportar con los filtros actuales." : ""}>
        <Button
          variant="outline"
          onClick={onExportar}
          disabled={totalFiltrado === 0}
          className="hidden sm:inline-flex"
        >
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </Hint>
      {/* v13.223.0 · Capa 3 Tranche A · 3.2: acciones secundarias primero,
          primary (`Nueva cotización`) pegado al borde derecho (Fitts's law). */}
      {canEdit && (
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/cotizaciones/nueva/tarifario")}
          className="hidden sm:inline-flex"
        >
          <Plus className="h-4 w-4 mr-2" /> Nuevo tarifario
        </Button>
      )}
      {canEdit && (
        <Button onClick={onNueva} className="hidden sm:inline-flex">
          <Plus className="h-4 w-4 mr-2" /> Nueva cotización
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="sm:hidden" aria-label="Más acciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/cotizaciones/plantillas">
              <Sparkles className="mr-2 h-4 w-4" /> Plantillas
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportar} disabled={totalFiltrado === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </DropdownMenuItem>

        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

