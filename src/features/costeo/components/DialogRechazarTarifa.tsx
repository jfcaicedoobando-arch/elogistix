/**
 * Diálogo: capturar motivo de rechazo de una tarifa.
 * Wrapper sobre el ReasonDialog genérico (mantiene la API existente).
 */
import { XCircle } from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (motivo: string) => void;
  pending?: boolean;
}

export function DialogRechazarTarifa({ open, onOpenChange, onConfirm, pending }: Props) {
  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      pending={pending}
      icon={XCircle}
      title="Rechazar tarifa"
      description="Escribe un motivo claro para que el agente sepa qué corregir antes de reenviar la tarifa."
      label="Motivo"
      placeholder="Ej. El flete base parece duplicado. Revisa con la naviera."
      confirmLabel="Rechazar"
      minLength={5}
    />
  );
}
