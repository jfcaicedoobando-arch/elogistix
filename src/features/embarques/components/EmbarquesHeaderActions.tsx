import { Plus, Download, MoreHorizontal, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  canEdit: boolean;
  exportandoCsv: boolean;
  onExport: () => void;
  onNuevo: () => void;
  /** UIA-16: alta guiada desde cotización cuando el alta directa está bloqueada. */
  onNuevoDesdeCotizacion?: () => void;
}

/** Acciones del header de la página de Embarques (extraídas para bajar complejidad). */
export function EmbarquesHeaderActions({
  canEdit, exportandoCsv, onExport, onNuevo, onNuevoDesdeCotizacion,
}: Props) {
  const exportLabel = exportandoCsv ? "Exportando…" : "Exportar CSV";
  return (
    <>
      <Button variant="outline" onClick={onExport} disabled={exportandoCsv} className="hidden md:inline-flex">
        <Download className="h-4 w-4 mr-2" /> {exportLabel}
      </Button>
      {canEdit ? (
        <Button onClick={onNuevo} className="hidden md:inline-flex">
          <Plus className="h-4 w-4 mr-2" /> Nuevo embarque
        </Button>
      ) : null}
      {!canEdit && onNuevoDesdeCotizacion ? (
        // v13.823.323 — la CTA ya no dice "Nuevo embarque": la creación real sólo
        // existe dentro de una cotización aceptada, así que el botón anuncia su
        // destino real en vez de prometer un alta que no existe en esta pantalla.
        <Button onClick={onNuevoDesdeCotizacion} className="hidden md:inline-flex">
          <ClipboardList className="h-4 w-4 mr-2" /> Ver cotizaciones
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Más acciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onExport} disabled={exportandoCsv}>
            <Download className="h-4 w-4 mr-2" /> {exportLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
