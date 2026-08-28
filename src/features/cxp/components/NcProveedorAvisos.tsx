/**
 * Avisos de moneda y tope de una nota de crédito de proveedor.
 * v13.779.0 · H8-B: la NC puede venir en moneda distinta a la factura, así que
 * hay que decir explícitamente cómo se está valuando contra el saldo.
 */
import { formatCurrency } from "@/lib/formatters";
import type { MonedaNotaCreditoProveedor as MonedaNC } from "@/features/cxp/types";

interface Props {
  cruceInvalido: boolean;
  moneda: MonedaNC;
  monedaFactura: MonedaNC;
  montoNum: number;
  montoEnFactura: number | null;
  excede: boolean;
}

export function NcProveedorAvisos({
  cruceInvalido,
  moneda,
  monedaFactura,
  montoNum,
  montoEnFactura,
  excede,
}: Props) {
  const otraMoneda = !cruceInvalido && moneda !== monedaFactura;
  return (
    <>
      {cruceInvalido && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-body-sm text-destructive">
          No existe tipo de cambio entre {moneda} y {monedaFactura}. Captura la nota de crédito en{" "}
          {monedaFactura} o en MXN.
        </div>
      )}

      {otraMoneda && montoEnFactura === null && montoNum > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-body-sm text-muted-foreground">
          Al guardar se aplicará el tipo de cambio del DOF de la fecha de la NC para valuarla en{" "}
          {monedaFactura}.
        </div>
      )}

      {otraMoneda && montoEnFactura !== null && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-body-sm text-muted-foreground">
          Equivale a {formatCurrency(montoEnFactura, monedaFactura)} contra el saldo de la factura.
        </div>
      )}

      {excede && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-body-sm text-destructive">
          El monto de la nota de crédito excede el saldo pendiente de la factura.
        </div>
      )}
    </>
  );
}
