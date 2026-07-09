/**
 * Wrapper delgado sobre `ConfirmActionDialog` para preservar la API previa
 * de los consumidores del módulo Costeo. La lógica canónica vive en
 * `@/components/shared/dialogs/ConfirmActionDialog`.
 */
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
}

export function ConfirmDeleteAlert({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Eliminar",
  onConfirm,
  pending = false,
}: Props) {
  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant="destructive"
      isPending={pending}
      onConfirm={onConfirm}
    />
  );
}
