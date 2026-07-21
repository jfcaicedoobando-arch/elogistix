/**
 * Modal reutilizable para confirmar la emisión que rebasa el límite de crédito
 * de un cliente. Se dispara desde flujos de factura manual y conversión de proforma.
 */
import { AlertTriangle } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import type { ValidarLimiteResultado } from "@/features/cliente/hooks/useValidarLimiteCredito";

function fmtMxn(v: number): string {
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
}

interface Props {
  alerta: ValidarLimiteResultado | null;
  clienteNombre?: string;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function CreditoExcesoConfirmDialog({ alerta, clienteNombre, onOpenChange, onConfirm }: Props) {
  const limite = alerta?.exposicion.limiteMxn ?? 0;
  const enUso = alerta?.exposicion.enUsoMxn ?? 0;
  const totalProy = alerta?.totalProyectadoMxn ?? 0;
  const exceso = alerta?.excedentePotencialMxn ?? 0;
  const nueva = totalProy - enUso;

  return (
    <ConfirmActionDialog
      open={!!alerta}
      onOpenChange={onOpenChange}
      title="Límite de crédito excedido"
      titleIcon={<AlertTriangle className="h-5 w-5 text-warning" />}
      confirmLabel="Continuar de todas formas"
      cancelLabel="Cancelar"
      size="md"
      onConfirm={onConfirm}
      description={alerta ? (
        <div className="space-y-1 text-sm">
          <p>
            <strong>{clienteNombre ?? "El cliente"}</strong> excederá su límite en{" "}
            <strong>{fmtMxn(exceso)}</strong>.
          </p>
          <p className="text-muted-foreground">
            Límite: {fmtMxn(limite)} · En uso: {fmtMxn(enUso)} · Nueva: {fmtMxn(nueva)}
          </p>
          <p className="text-xs text-muted-foreground pt-2">
            Se registrará en bitácora que continuaste a pesar del exceso.
          </p>
        </div>
      ) : null}
    />
  );
}
