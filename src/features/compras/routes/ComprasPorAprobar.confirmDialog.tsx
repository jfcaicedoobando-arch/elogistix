/**
 * AlertDialog de confirmación para aprobar facturas en lote.
 * Extraído de `ComprasPorAprobar.tsx` para respetar el límite de 200 líneas.
 * v13.232.0 · Migrado a `ConfirmActionDialog` (Lote 7d.2).
 */
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
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
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={`Aprobar ${cantidad} factura(s) en lote`}
      confirmLabel={`Aprobar ${cantidad}`}
      isPending={isRunning}
      onConfirm={onConfirm}
      description={
        <div className="space-y-2 text-sm">
          <p>
            Vas a aprobar <strong>{cantidad}</strong> solicitudes en un solo paso. El total involucrado es:
          </p>
          <ul className="list-disc pl-5 text-muted-foreground text-xs space-y-0.5">
            <li>{formatCurrency(totalMxn, "MXN")}</li>
            <li>{formatCurrency(totalUsd, "USD")}</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            El proceso corre factura por factura. Si alguna falla, te lo indicamos al final para revisarla manualmente.
          </p>
        </div>
      }
    />
  );
}
