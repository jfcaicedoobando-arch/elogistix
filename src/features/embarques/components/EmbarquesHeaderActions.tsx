import { Plus, Download, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  canEdit: boolean;
  exportandoCsv: boolean;
  onExport: () => void;
  onNuevo: () => void;
}

/** Acciones del header de la página de Embarques (extraídas para bajar complejidad). */
export function EmbarquesHeaderActions({ canEdit, exportandoCsv, onExport, onNuevo }: Props) {
  const exportLabel = exportandoCsv ? "Exportando..." : "Exportar CSV";
  return (
    <>
      <Button variant="outline" onClick={onExport} disabled={exportandoCsv} className="hidden md:inline-flex">
        <Download className="h-4 w-4 mr-2" /> {exportLabel}
      </Button>
      {canEdit ? (
        <Button onClick={onNuevo} className="hidden md:inline-flex">
          <Plus className="h-4 w-4 mr-2" /> Nuevo Embarque
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Más acciones">
            <MoreVertical className="h-5 w-5" />
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
