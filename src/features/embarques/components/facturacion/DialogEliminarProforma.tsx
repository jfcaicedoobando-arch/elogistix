/**
 * AlertDialog de confirmación para eliminar una proforma desde `TabFacturacion`.
 * Extraído del componente padre para respetar el límite Power of 10
 * (≤200 líneas por archivo).
 */
import { Loader2 } from "lucide-react";
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
import { dialogSize } from "@/components/shared/utils/dialogTokens";

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
    <AlertDialog open={!!proformaAEliminar} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className={dialogSize.sm}>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar proforma</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de eliminar la proforma <strong>{proformaAEliminar?.numero}</strong>?
            Los conceptos volverán a estado Pendiente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</>
            ) : (
              <>Eliminar</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
