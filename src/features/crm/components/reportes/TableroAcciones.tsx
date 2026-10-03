/**
 * Botones del encabezado de /crm/reportes (solo súper administrador):
 * renombrar, eliminar, agregar reporte y nuevo tablero.
 */
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CrmTableroRow } from "@/features/crm/services/reportes/tiposReportes";

interface Props {
  tableroActivo: CrmTableroRow | null;
  onNuevoTablero: () => void;
  onRenombrar: () => void;
  onEliminar: () => void;
  onAgregarReporte: () => void;
}

export function TableroAcciones({ tableroActivo, onNuevoTablero, onRenombrar, onEliminar, onAgregarReporte }: Props) {
  return (
    <div className="flex items-center gap-2">
      {tableroActivo && (
        <>
          <Button variant="outline" size="sm" onClick={onRenombrar}>
            <Pencil className="mr-1.5 size-4" /> Renombrar
          </Button>
          <Button variant="outline" size="sm" onClick={onEliminar}>
            <Trash2 className="mr-1.5 size-4" /> Eliminar
          </Button>
          <Button size="sm" onClick={onAgregarReporte}>
            <Plus className="mr-1.5 size-4" /> Agregar reporte
          </Button>
        </>
      )}
      <Button variant={tableroActivo ? "outline" : "default"} size="sm" onClick={onNuevoTablero}>
        <Plus className="mr-1.5 size-4" /> Nuevo tablero
      </Button>
    </div>
  );
}
