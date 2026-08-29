/**
 * Modal reutilizable para confirmar la emisión que rebasa el límite de crédito
 * de un cliente. Se dispara desde flujos de factura manual y conversión de proforma.
 */
import { AlertTriangle } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { formatCurrency } from "@/lib/formatters";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  puedeExcederCredito,
  type ValidarLimiteResultado,
} from "@/features/cliente/hooks/useValidarLimiteCredito";

function fmtMxn(v: number): string {
  return formatCurrency(v, "MXN");
}

interface Props {
  alerta: ValidarLimiteResultado | null;
  clienteNombre?: string;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function CreditoExcesoConfirmDialog({ alerta, clienteNombre, onOpenChange, onConfirm }: Props) {
  // M-15 (v14-2): fail-closed — sólo gerencia/finanzas puede autorizar el exceso.
  const { effectiveRole, orgRole, role } = useAuth();
  const puedeExceder = puedeExcederCredito(effectiveRole ?? orgRole ?? role);
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
      confirmDisabled={!puedeExceder}
      onConfirm={onConfirm}
      description={alerta ? (
        <div className="space-y-1 text-body">
          <p>
            <strong>{clienteNombre ?? "El cliente"}</strong> excederá su límite en{" "}
            <strong>{fmtMxn(exceso)}</strong>.
          </p>
          <p className="text-muted-foreground">
            Límite: {fmtMxn(limite)} · En uso: {fmtMxn(enUso)} · Nueva: {fmtMxn(nueva)}
          </p>
          {puedeExceder ? (
            <p className="text-body-sm text-muted-foreground pt-2">
              Se registrará en bitácora que continuaste a pesar del exceso.
            </p>
          ) : (
            <p className="text-body-sm pt-2 font-medium text-destructive">
              Tu rol no puede autorizar excesos de crédito. Pide a gerencia o finanzas
              que confirme la operación.
            </p>
          )}
        </div>
      ) : null}
    />
  );
}
