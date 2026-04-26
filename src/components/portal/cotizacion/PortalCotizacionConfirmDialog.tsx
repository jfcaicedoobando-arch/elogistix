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
import { Textarea } from "@/components/ui/textarea";

type ConfirmAction = "Aceptada" | "Rechazada" | null;

interface PortalCotizacionConfirmDialogProps {
  confirmAction: ConfirmAction;
  comentario: string;
  isPending: boolean;
  onCommentChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Diálogo de confirmación para aceptar/rechazar una cotización con comentario opcional. */
export default function PortalCotizacionConfirmDialog({
  confirmAction,
  comentario,
  isPending,
  onCommentChange,
  onOpenChange,
  onConfirm,
}: PortalCotizacionConfirmDialogProps) {
  const isAceptar = confirmAction === "Aceptada";
  return (
    <AlertDialog open={!!confirmAction} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isAceptar ? "¿Aceptar esta cotización?" : "¿Rechazar esta cotización?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isAceptar
              ? "Al aceptar, el equipo de operaciones será notificado para proceder con el embarque. Esta acción no se puede deshacer."
              : "Al rechazar, la cotización quedará cerrada. Si necesitas cambios, contacta al equipo de operaciones."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder={isAceptar ? "¿Algún comentario? (opcional)" : "¿Motivo del rechazo? (opcional)"}
          value={comentario}
          onChange={(e) => onCommentChange(e.target.value)}
          className="min-h-[80px]"
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className={
              !isAceptar
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {isPending ? "Procesando..." : isAceptar ? "Sí, aceptar" : "Sí, rechazar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
