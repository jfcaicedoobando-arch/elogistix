/**
 * Subcomponentes pequeños del DialogRegistrarPagoProveedor (header info + saldo summary).
 */
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";

export function PagoFacturaHeaderInfo({ factura }: { factura: FacturaCxP }) {
  return (
    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
      <span>Saldo: <strong className="text-foreground tabular-nums">
        {formatCurrency(factura.saldo, factura.moneda)}
      </strong></span>
      <span>Total: <strong className="text-foreground tabular-nums">
        {formatCurrency(factura.total, factura.moneda)}
      </strong></span>
    </div>
  );
}

export function PagoSaldoRestante({
  factura, saldoRestante, excede,
}: { factura: FacturaCxP | null; saldoRestante: number; excede: boolean }) {
  return (
    <>
      <div className="rounded-lg border bg-muted/40 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Saldo restante tras el pago</span>
        <span className={cn(
          "text-lg font-semibold tabular-nums",
          excede ? "text-destructive" : saldoRestante === 0 ? "text-success" : "text-foreground",
        )}>
          {factura ? formatCurrency(saldoRestante, factura.moneda) : "—"}
        </span>
      </div>
      {excede && <p className="text-xs text-destructive">El monto excede el saldo pendiente.</p>}
    </>
  );
}
