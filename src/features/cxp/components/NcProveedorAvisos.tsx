/**
 * Avisos de moneda y tope de una nota de crédito de proveedor.
 * v13.779.0 · H8-B: la NC puede venir en moneda distinta a la factura, así que
 * hay que decir explícitamente cómo se está valuando contra el saldo.
 */
import { Alert, AlertDescription } from "@/components/ui/alert";
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
        <Alert variant="destructive" className="px-3 py-2">
          <AlertDescription className="text-body-sm">
            No existe tipo de cambio entre {moneda} y {monedaFactura}. Captura la nota de crédito en{" "}
            {monedaFactura} o en MXN.
          </AlertDescription>
        </Alert>
      )}

      {otraMoneda && montoEnFactura === null && montoNum > 0 && (
        <Alert variant="warning" className="px-3 py-2">
          <AlertDescription className="text-body-sm">
            Al guardar se aplicará el tipo de cambio del DOF de la fecha de la NC para valuarla en{" "}
            {monedaFactura}.
          </AlertDescription>
        </Alert>
      )}

      {otraMoneda && montoEnFactura !== null && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-body-sm text-muted-foreground">
          Equivale a {formatCurrency(montoEnFactura, monedaFactura)} contra el saldo de la factura.
        </div>
      )}

      {excede && (
        <Alert variant="destructive" className="px-3 py-2">
          <AlertDescription className="text-body-sm">
            El monto de la nota de crédito excede el saldo pendiente de la factura.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
