/**
 * Acciones del encabezado del detalle de oportunidad (v13.629.1).
 * Extraído de `OportunidadDetalleContent` para bajar su complejidad.
 */
import { ClipboardList, Edit, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  crearCotizacion: () => void;
  crearCotPending: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}

export function OportunidadDetalleAcciones({
  crearCotizacion, crearCotPending, onEditar, onEliminar,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={crearCotizacion} disabled={crearCotPending}>
        {crearCotPending ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <ClipboardList className="h-4 w-4 mr-1" />
        )}
        Nueva cotización
      </Button>
      <Button size="sm" variant="outline" onClick={onEditar}>
        <Edit className="h-4 w-4 mr-1" /> Editar
      </Button>
      <Button size="sm" variant="destructive" onClick={onEliminar}>
        <Trash2 className="h-4 w-4 mr-1" /> Eliminar
      </Button>
    </div>
  );
}
