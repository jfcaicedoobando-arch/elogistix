/**
 * Wrapper delgado sobre `ConfirmActionDialog` (variant destructive).
 * Extraído de `TabFacturacion` para respetar Power of 10 (≤200 líneas).
 */
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

interface Props {
  proformaAEliminar: { id: string; numero: string } | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function DialogEliminarProforma({
  proformaAEliminar, isPending, onCancel, onConfirm,
}: Props) {
  return (
    <ConfirmActionDialog
      open={!!proformaAEliminar}
      onOpenChange={(o) => { if (!o) onCancel(); }}
      title="Cancelar proforma"
      description={
        <>
          ¿Cancelar la proforma <strong>{proformaAEliminar?.numero}</strong>? Quedará en el
          historial como Cancelada y sus conceptos volverán a Pendiente para hacer una nueva.
        </>
      }
      confirmLabel="Cancelar proforma"
      variant="destructive"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
