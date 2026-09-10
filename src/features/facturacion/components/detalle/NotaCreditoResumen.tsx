/**
 * Resumen de importes de la nota de crédito: subtotal, IVA, total, saldo de la
 * factura y saldo que quedará. Evita la sorpresa de "excede el saldo" al
 * momento de guardar (v13.823.297).
 */
import { formatCurrency } from "@/lib/formatters/numbers";
import type { TotalesNC } from "@/features/facturacion/utils/notaCreditoTotales";

interface Props {
  totales: TotalesNC;
  saldoFactura: number;
  saldoRestante: number;
  monedaFactura: string;
  excedeSaldo: boolean;
}

function Fila({ label, valor, fuerte, alerta }: { label: string; valor: string; fuerte?: boolean; alerta?: boolean }) {
  return (
    <div className="flex items-center justify-between text-body-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${fuerte ? "font-semibold" : ""} ${alerta ? "text-destructive" : ""}`}>
        {valor}
      </span>
    </div>
  );
}

export function NotaCreditoResumen(props: Props) {
  const { totales, saldoFactura, saldoRestante, monedaFactura, excedeSaldo } = props;
  return (
    <div className="rounded-md border p-3 space-y-1">
      <Fila label="Subtotal" valor={formatCurrency(totales.subtotal, monedaFactura)} />
      <Fila label="IVA" valor={formatCurrency(totales.iva, monedaFactura)} />
      <Fila label="Total de la nota" valor={formatCurrency(totales.total, monedaFactura)} fuerte alerta={excedeSaldo} />
      <Fila label="Saldo de la factura" valor={formatCurrency(saldoFactura, monedaFactura)} />
      <Fila
        label="Saldo después de la nota"
        valor={formatCurrency(saldoRestante, monedaFactura)}
        alerta={excedeSaldo}
      />
      {excedeSaldo && (
        <p className="text-body-sm text-destructive pt-1">
          El total de la nota excede el saldo de la factura. Reduce los importes.
        </p>
      )}
    </div>
  );
}
