/**
 * Diálogo de confirmación para sincronizar la fecha de llegada real del
 * embarque tras un evento de tracking de arribo/entrega. Extraído de
 * `TrackingNuevoEventoForm` (12.51.15) para respetar Power of 10 ≤200 líneas.
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
import { formatDate } from "@/lib/formatters";
import { dialogSize } from "@/components/shared/utils/dialogTokens";

interface Props {
  fechaIso: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TrackingConfirmFechaLlegadaDialog({ fechaIso, onConfirm, onCancel }: Props) {
  return (
    <AlertDialog open={!!fechaIso} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className={dialogSize.sm}>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Actualizar fecha de llegada real?</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Quieres registrar{" "}
            <strong>{fechaIso ? formatDate(fechaIso, "dd/MM/yyyy") : ""}</strong> como
            la fecha de llegada real del embarque? Esto actualiza la ETA real visible para todos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>No, sólo el evento</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Sí, actualizar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
