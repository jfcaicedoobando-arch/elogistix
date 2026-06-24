/**
 * Diálogo genérico para capturar un motivo/razón antes de ejecutar una acción
 * destructiva (rechazar, cancelar, etc.).
 *
 * Reemplaza patrones duplicados (DialogRechazarTarifa, rechazo de factura
 * proveedor, etc.) con un único componente basado en FormDialogShell.
 */
import { useEffect, useState } from "react";
import { AlertOctagon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Acción asíncrona. El motivo ya viene `.trim()`-eado. */
  onConfirm: (motivo: string) => void | Promise<void>;
  title: string;
  description?: string;
  /** Etiqueta del textarea. Default: "Motivo". */
  label?: string;
  /** Placeholder del textarea. */
  placeholder?: string;
  /** Texto del botón destructivo. Default: "Confirmar". */
  confirmLabel?: string;
  /** Mínimo de caracteres requeridos para habilitar el botón. Default: 5. */
  minLength?: number;
  pending?: boolean;
  icon?: LucideIcon;
}

export function ReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  label = "Motivo",
  placeholder,
  confirmLabel = "Confirmar",
  minLength = 5,
  pending = false,
  icon = AlertOctagon,
}: Props) {
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!open) setMotivo("");
  }, [open]);

  const valido = motivo.trim().length >= minLength;

  const handleConfirm = async () => {
    if (!valido) return;
    await onConfirm(motivo.trim());
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={icon}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!valido || pending}
          >
            {pending ? "Procesando…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="reason-dialog-motivo">
          {label} <span className="text-muted-foreground text-xs">(mínimo {minLength} caracteres)</span>
        </Label>
        <Textarea
          id="reason-dialog-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={placeholder}
          rows={4}
          autoFocus
        />
      </div>
    </FormDialogShell>
  );
}
