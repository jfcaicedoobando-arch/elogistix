/**
 * Alerta de límite de crédito excedido al convertir una proforma a factura.
 * Extraído de `AccionesProforma.tsx` (Power-of-10: archivos < 200 líneas).
 */
import { AlertTriangle } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { formatCurrency } from "@/lib/formatters";
import type { ValidarLimiteResultado } from "@/features/cliente/hooks/useValidarLimiteCredito";

interface Props {
  resultado: ValidarLimiteResultado | null;
  clienteNombre: string | null | undefined;
  montoNuevaFactura: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

function fmtMxn(v: number): string {
  return formatCurrency(v, "MXN");
}

export function AlertaLimiteCreditoDialog({
  resultado, clienteNombre, montoNuevaFactura, onOpenChange, onConfirm,
}: Props) {
  return (
    <ConfirmActionDialog
      open={!!resultado}
      onOpenChange={onOpenChange}
      title="Límite de crédito excedido"
      titleIcon={<AlertTriangle className="h-5 w-5 text-warning" />}
      confirmLabel="Facturar de todas formas"
      cancelLabel="Cancelar"
      size="md"
      onConfirm={onConfirm}
      description={resultado ? (
        <div className="space-y-1 text-sm">
          <p>
            <strong>{clienteNombre ?? "El cliente"}</strong> excederá su límite en
            {" "}<strong>{fmtMxn(resultado.excedentePotencialMxn)}</strong>.
          </p>
          <p className="text-muted-foreground">
            Límite: {fmtMxn(resultado.exposicion.limiteMxn ?? 0)} · En uso: {fmtMxn(resultado.exposicion.enUsoMxn)} · Nueva factura: {fmtMxn(montoNuevaFactura)}
          </p>
          <p className="text-xs text-muted-foreground pt-2">
            Se registrará en bitácora que continuaste a pesar del exceso.
          </p>
        </div>
      ) : null}
    />
  );
}
