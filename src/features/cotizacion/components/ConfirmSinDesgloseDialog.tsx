import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

/**
 * Confirmación destructiva para el atajo "Cotizar sin desglose".
 * Requiere checkbox explícito antes de habilitar el botón.
 * mem://features/data-safety-confirmations
 */
export function ConfirmSinDesgloseDialog({ open, onOpenChange, onConfirm, isPending = false }: Props) {
  const [acepta, setAcepta] = useState(false);
  useEffect(() => { if (!open) setAcepta(false); }, [open]);

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="¿Cotizar sin cargar costos?"
      titleIcon={<AlertTriangle className="h-5 w-5" aria-hidden />}
      titleDestructive
      variant="destructive"
      confirmLabel="Sí, cotizar sin desglose"
      confirmDisabled={!acepta}
      isPending={isPending}
      onConfirm={onConfirm}
      description={
        <div className="space-y-3 text-sm">
          <p>
            Estás por crear una cotización <strong>sin desglose interno de costos</strong>.
            Esta práctica se desaconseja porque:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>No se calcula margen ni P&amp;L.</li>
            <li>El embarque derivado quedará <strong>bloqueado</strong> hasta cargar los costos.</li>
            <li>El detalle interno de la operación queda incompleto.</li>
          </ul>
        </div>
      }
    >
      <label
        htmlFor="cotizar-sin-desglose-acepta"
        className="flex items-start gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 cursor-pointer"
      >
        <Checkbox
          id="cotizar-sin-desglose-acepta"
          checked={acepta}
          onCheckedChange={(v) => setAcepta(v === true)}
          className="mt-0.5"
        />
        <span className="text-xs leading-relaxed">
          Entiendo que esta cotización no tiene costos cargados y el embarque
          no podrá iniciarse hasta completarlos.
        </span>
      </label>
    </ConfirmActionDialog>
  );
}
