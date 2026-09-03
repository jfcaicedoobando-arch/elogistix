/**
 * Acciones del encabezado del detalle de oportunidad.
 * Cada acción usa su propio candado: editar/eliminar exigen gestión de la
 * oportunidad; "Nueva cotización" sólo escritura de cotizaciones (SALES).
 */
import { ClipboardList, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  crearCotizacion: () => void;
  crearCotPending: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  canCotizar: boolean;
  canGestionar: boolean;
}

export function OportunidadDetalleAcciones({
  crearCotizacion, crearCotPending, onEditar, onEliminar, canCotizar, canGestionar,
}: Props) {
  if (!canCotizar && !canGestionar) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canCotizar && (
        <Button size="sm" variant="outline" onClick={crearCotizacion} disabled={crearCotPending} loading={crearCotPending}>
          {!crearCotPending && <ClipboardList className="h-4 w-4 mr-1" />}
          Nueva cotización
        </Button>
      )}
      {canGestionar && (
        <>
          <Button size="sm" variant="outline" onClick={onEditar}>
            <Edit className="h-4 w-4 mr-1" /> Editar
          </Button>
          <Button size="sm" variant="destructive" onClick={onEliminar}>
            <Trash2 className="h-4 w-4 mr-1" /> Eliminar
          </Button>
        </>
      )}
    </div>
  );
}
