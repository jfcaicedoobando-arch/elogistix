/**
 * Acciones del encabezado del detalle de oportunidad.
 * Cada acción usa su propio candado: editar/eliminar exigen gestión de la
 * oportunidad; "Nueva cotización" sólo escritura de cotizaciones (SALES).
 */
import { ClipboardList, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";

interface Props {
  crearCotizacion: () => void;
  crearCotPending: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  canCotizar: boolean;
  canGestionar: boolean;
  /** La oportunidad ya tiene cliente asociado. Sin cliente no se puede cotizar. */
  tieneCliente: boolean;
}

export function OportunidadDetalleAcciones({
  crearCotizacion, crearCotPending, onEditar, onEliminar, canCotizar, canGestionar, tieneCliente,
}: Props) {
  if (!canCotizar && !canGestionar) return null;
  // v13.823.77 — sin cliente la cotización no puede crearse: el botón queda
  // deshabilitado con la razón visible en lugar de no hacer nada al pulsarlo.
  const motivoSinCliente = "Convierte el prospecto en cliente para poder cotizar.";
  return (
    <div className="flex flex-wrap gap-2">
      {canCotizar && (
        <Hint label={tieneCliente ? undefined : motivoSinCliente}>
          <Button
            size="sm"
            variant="outline"
            onClick={crearCotizacion}
            disabled={crearCotPending || !tieneCliente}
            loading={crearCotPending}
            aria-describedby={tieneCliente ? undefined : "oportunidad-cotizar-motivo"}
          >
            {!crearCotPending && <ClipboardList className="h-4 w-4 mr-1" />}
            Nueva cotización
          </Button>
        </Hint>
      )}
      {canCotizar && !tieneCliente && (
        <span id="oportunidad-cotizar-motivo" className="sr-only">{motivoSinCliente}</span>
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
