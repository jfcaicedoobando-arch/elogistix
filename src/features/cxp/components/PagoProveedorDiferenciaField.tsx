/**
 * Campo de diferencia cambiaria del pago a proveedor.
 *
 * MNY: sólo el par USD/MXN se calcula y guarda en la base; para otras divisas
 * se explica en pantalla en vez de aceptar un dato que se perdería.
 */
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormDialogSection as FormSection } from "@/components/shared/FormDialogShell";
import type { PagoProveedorFormBodyProps } from "./PagoProveedorFormBody.types";

type Props = Pick<
  PagoProveedorFormBodyProps,
  "soportaDiferenciaCambiaria" | "esUsdPagadoEnMxn" | "diffMxn" | "setDiffMxn" | "factura"
>;

export function PagoProveedorDiferenciaField(p: Props) {
  if (p.soportaDiferenciaCambiaria) {
    return (
      <FormSection title="Diferencia cambiaria">
        <div className="space-y-1">
          <Label htmlFor="pago-prov-diff-mxn">Diferencia cambiaria MXN (opcional)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-muted-foreground">$</span>
            <Input
              id="pago-prov-diff-mxn" type="number" step="0.01" inputMode="decimal" placeholder="0.00"
              className="pl-7 text-right tabular-nums"
              value={p.diffMxn} onChange={(e) => p.setDiffMxn(e.target.value)}
            />
          </div>
          <p className="text-body-sm text-muted-foreground">
            Captura la diferencia cambiaria entre el TC de la factura y el TC del pago.
          </p>
        </div>
      </FormSection>
    );
  }
  if (p.esUsdPagadoEnMxn && p.factura) {
    return (
      <p className="text-body-sm text-muted-foreground">
        La diferencia cambiaria automática sólo está disponible para pagos entre USD y MXN;
        este pago en {p.factura.moneda} no la registra.
      </p>
    );
  }
  return null;
}
