import { useState, useEffect } from "react";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Loader2 } from "lucide-react";

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={dialogSize.md}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            ¿Cotizar sin cargar costos?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
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
              <label className="flex items-start gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 cursor-pointer">
                <Checkbox
                  checked={acepta}
                  onCheckedChange={(v) => setAcepta(v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed">
                  Entiendo que esta cotización no tiene costos cargados y el embarque
                  no podrá iniciarse hasta completarlos.
                </span>
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!acepta || isPending}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending
              ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Procesando…</>
              : "Sí, cotizar sin desglose"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
