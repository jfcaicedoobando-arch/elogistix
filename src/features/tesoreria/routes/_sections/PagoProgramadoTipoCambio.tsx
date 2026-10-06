/** Valuación explícita del pago programado, independiente de la moneda bancaria. */
import { NumericInput } from "@/components/shared/NumericInput";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  moneda: string;
  monto: number;
  tipoCambio: number | null | undefined;
  error?: string;
  onChange: (value: number) => void;
}

export function PagoProgramadoTipoCambio({ moneda, monto, tipoCambio, error, onChange }: Props) {
  if (moneda.toUpperCase() === "MXN") return null;
  return <div className="sm:col-span-2 space-y-1">
    <Label htmlFor="pago-tc">Tipo de cambio (MXN por {moneda}) *</Label>
    <NumericInput id="pago-tc" decimals value={tipoCambio ?? 0}
      onChange={onChange} aria-describedby="pago-tc-ayuda" />
    <p id="pago-tc-ayuda" className="text-body-sm text-muted-foreground">
      Revisa la tasa del pago. La tasa de la factura es sólo una sugerencia editable.
    </p>
    {error
      ? <p role="alert" className="text-body-sm text-destructive">{error}</p>
      : <p className="text-body-sm">Equivalente: {formatCurrency(monto * Number(tipoCambio), "MXN")}</p>}
  </div>;
}
