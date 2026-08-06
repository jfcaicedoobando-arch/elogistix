import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { Label } from "@/components/ui/label";
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
    <ConfirmActionDialog
      open={!!confirmAction}
      onOpenChange={onOpenChange}
      size="md"
      title={isAceptar ? "¿Aceptar esta cotización?" : "¿Rechazar esta cotización?"}
      description={
        isAceptar
          ? "Al aceptar, el equipo de operaciones será notificado para proceder con el embarque. Esta acción no se puede deshacer."
          : "Al rechazar, la cotización quedará cerrada. Si necesitas cambios, contacta al equipo de operaciones."
      }
      variant={isAceptar ? "default" : "destructive"}
      confirmLabel={isAceptar ? "Sí, aceptar" : "Sí, rechazar"}
      isPending={isPending}
      onConfirm={onConfirm}
    >
      <div className="space-y-1.5">
        <Label htmlFor="portal-cotizacion-comentario" className="text-xs">
          {isAceptar ? "¿Algún comentario? (opcional)" : "¿Motivo del rechazo? (opcional)"}
        </Label>
        <Textarea
          id="portal-cotizacion-comentario"
          placeholder={isAceptar ? "Escribe un comentario…" : "Describe el motivo…"}
          value={comentario}
          onChange={(e) => onCommentChange(e.target.value)}
          className="min-h-20"
          disabled={isPending}
        />
      </div>
    </ConfirmActionDialog>
  );
}
