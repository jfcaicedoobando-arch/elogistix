/**
 * Diálogo de confirmación para sincronizar la fecha de llegada real del
 * embarque tras un evento de tracking de arribo/entrega.
 *
 * v13.152.1: migrado a `ConfirmActionDialog` (Ola 3, Lote A).
 */
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { formatDate } from "@/lib/formatters";

interface Props {
  fechaIso: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TrackingConfirmFechaLlegadaDialog({ fechaIso, onConfirm, onCancel }: Props) {
  const fechaFmt = fechaIso ? formatDate(fechaIso, "dd/MM/yyyy") : "";
  return (
    <ConfirmActionDialog
      open={!!fechaIso}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title="¿Actualizar fecha de llegada real?"
      description={`¿Quieres registrar ${fechaFmt} como la fecha de llegada real del embarque? Esto actualiza la ETA real visible para todos.`}
      cancelLabel="No, sólo el evento"
      confirmLabel="Sí, actualizar"
      onConfirm={onConfirm}
    />
  );
}
