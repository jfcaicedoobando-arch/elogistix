import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/formatters";
import { tieneSaldoMonetario } from "@/lib/financial/toleranciaPago";

export function FacturaSaldoResidualAlert({ saldo, pagado, estado, metodoPago, moneda }: {
  saldo: number; pagado: number; estado: string; metodoPago?: string | null; moneda: string;
}) {
  if (!tieneSaldoMonetario(saldo) || pagado <= 0 ||
    ["Cancelada", "Sustituida", "Borrador"].includes(estado) ||
    (estado !== "Pagada" && metodoPago !== "PUE")) return null;
  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>Saldo pendiente por revisar</AlertTitle>
      <AlertDescription>
        Quedan {formatCurrency(saldo, moneda)} pendientes según los cobros y notas de crédito registrados.
        {metodoPago === "PUE"
          ? " Esta factura PUE ya tiene un cobro: no admite una segunda exhibición. Revisa el pago previo con Cobranza; el saldo no se ha condonado."
          : " El estado guardado es Pagada, pero los cobros registrados no cubren el saldo completo."}
      </AlertDescription>
    </Alert>
  );
}
