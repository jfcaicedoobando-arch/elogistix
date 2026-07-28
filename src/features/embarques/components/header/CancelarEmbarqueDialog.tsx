import { useState } from "react";
import { Ban } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expediente: string;
  isPending: boolean;
  onConfirm: (motivo: string) => Promise<void> | void;
}

/**
 * Diálogo de cancelación de embarque con captura de motivo (≥5 caracteres).
 * Extraído para mantener EmbarqueDetalleHeaderActions ≤200 líneas.
 */
export function CancelarEmbarqueDialog({ open, onOpenChange, expediente, isPending, onConfirm }: Props) {
  const [motivo, setMotivo] = useState("");
  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancelar embarque ${expediente}`}
      description="Esta acción marca el embarque como Cancelado y detiene el flujo operativo. Documenta el motivo para trazabilidad."
      variant="destructive"
      titleIcon={<Ban className="h-4 w-4" />}
      titleDestructive
      confirmLabel="Cancelar embarque"
      cancelLabel="Volver"
      isPending={isPending}
      confirmDisabled={motivo.trim().length < 5}
      size="md"
      onConfirm={async () => {
        await onConfirm(motivo.trim());
        onOpenChange(false);
        setMotivo("");
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="motivo-cancelar">Motivo (mínimo 5 caracteres)</Label>
        <Textarea
          id="motivo-cancelar"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. Cliente canceló la operación por falta de stock en origen."
          rows={3}
        />
      </div>
    </ConfirmActionDialog>
  );
}
