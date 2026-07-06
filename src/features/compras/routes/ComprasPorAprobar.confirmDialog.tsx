/**
 * AlertDialog de confirmación para aprobar facturas en lote.
 * Extraído de `ComprasPorAprobar.tsx` para respetar el límite de 200 líneas.
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
import { formatCurrency } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cantidad: number;
  totalMxn: number;
  totalUsd: number;
  isRunning: boolean;
  onConfirm: () => void;
}

export function ConfirmarAprobacionLoteDialog({
  open, onOpenChange, cantidad, totalMxn, totalUsd, isRunning, onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aprobar {cantidad} factura(s) en lote</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Vas a aprobar <strong>{cantidad}</strong> solicitudes en un solo paso. El total involucrado es:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground text-xs space-y-0.5">
                <li>MXN: {formatCurrency(totalMxn, "MXN")}</li>
                <li>USD: {formatCurrency(totalUsd, "USD")}</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                El proceso corre factura por factura. Si alguna falla, te lo indicamos al final para revisarla manualmente.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRunning}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isRunning}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isRunning && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Aprobar {cantidad}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
