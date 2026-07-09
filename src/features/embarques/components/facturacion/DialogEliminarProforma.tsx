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
      title="Eliminar proforma"
      description={
        <>
          ¿Estás seguro de eliminar la proforma <strong>{proformaAEliminar?.numero}</strong>?
          Los conceptos volverán a estado Pendiente.
        </>
      }
      confirmLabel="Eliminar"
      variant="destructive"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
