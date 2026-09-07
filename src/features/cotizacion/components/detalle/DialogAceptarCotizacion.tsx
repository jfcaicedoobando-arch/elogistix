/**
 * Confirmación al aceptar una cotización: explica que además se cierra la
 * oportunidad como Ganada y resuelve en el mismo paso el choque de monedas
 * entre cotización y oportunidad.
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface DialogAceptarCotizacionProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmar: () => void;
  enviando: boolean;
  cargandoMoneda: boolean;
  tieneOportunidad: boolean;
  hayChoqueMoneda: boolean;
  monedaCotizacion: string | null;
  monedaOportunidad: string | null;
}

export function DialogAceptarCotizacion({
  open, onOpenChange, onConfirmar, enviando, cargandoMoneda,
  tieneOportunidad, hayChoqueMoneda, monedaCotizacion, monedaOportunidad,
}: DialogAceptarCotizacionProps) {
  const etiquetaAccion = hayChoqueMoneda
    ? "Alinear moneda y aceptar"
    : "Aceptar cotización";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Aceptar esta cotización?</AlertDialogTitle>
          <AlertDialogDescription>
            {tieneOportunidad
              ? "La cotización quedará como Aceptada y la oportunidad se cerrará como Ganada, con el monto de esta cotización y la fecha de hoy."
              : "La cotización quedará como Aceptada y podrás crear el embarque desde aquí."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hayChoqueMoneda && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-body-sm text-foreground">
            La cotización está en <strong>{monedaCotizacion}</strong> y la oportunidad
            en <strong>{monedaOportunidad}</strong>. Para cerrarla, la oportunidad
            pasará a <strong>{monedaCotizacion}</strong>.
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={enviando || cargandoMoneda}
            onClick={(e) => {
              e.preventDefault();
              onConfirmar();
            }}
          >
            {enviando ? "Procesando…" : etiquetaAccion}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
