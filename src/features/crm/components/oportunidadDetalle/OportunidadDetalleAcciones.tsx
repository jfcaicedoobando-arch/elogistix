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
  /**
   * CRM-COT-01: la oportunidad puede cotizarse (tiene cliente, o es un
   * prospecto elegible del CRM y el cotizador se abre precargado).
   */
  puedeCotizar: boolean;
  /** Razón visible cuando no puede cotizarse. */
  motivoNoCotizar?: string;
}

export function OportunidadDetalleAcciones({
  crearCotizacion, crearCotPending, onEditar, onEliminar, canCotizar, canGestionar,
  puedeCotizar, motivoNoCotizar,
}: Props) {
  if (!canCotizar && !canGestionar) return null;
  // v13.823.77 — cuando no se puede cotizar el botón queda deshabilitado con la
  // razón visible en lugar de no hacer nada al pulsarlo.
  const motivo = motivoNoCotizar ?? "Esta oportunidad no puede cotizarse.";
  return (
    <div className="flex flex-wrap gap-2">
      {canCotizar && (
        <Hint label={puedeCotizar ? undefined : motivo}>
          <Button
            size="sm"
            onClick={crearCotizacion}
            disabled={crearCotPending || !puedeCotizar}
            loading={crearCotPending}
            aria-describedby={puedeCotizar ? undefined : "oportunidad-cotizar-motivo"}
          >
            {!crearCotPending && <ClipboardList className="h-4 w-4 mr-1" />}
            Nueva cotización
          </Button>
        </Hint>
      )}
      {canCotizar && !puedeCotizar && (
        <span id="oportunidad-cotizar-motivo" className="sr-only">{motivo}</span>
      )}
      {canGestionar && (
        <>
          <Button size="sm" variant="outline" onClick={onEditar}>
            <Edit className="h-4 w-4 mr-1" /> Editar
          </Button>
          {/* MEJ-20260908-03: "Nueva cotización" es la acción principal; eliminar
              queda como peligro secundario (outline) para no invitar al clic. */}
          <Button
            size="sm"
            variant="outline"
            onClick={onEliminar}
            className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Eliminar
          </Button>
        </>
      )}
    </div>
  );
}
