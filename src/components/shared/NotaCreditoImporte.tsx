import { formatCurrency, formatNumber } from "@/lib/formatters";
import { equivalenteNotaCredito, type ContextoFacturaNotaCredito } from "@/lib/financial/notaCreditoEquivalente";

interface Props {
  nota: { monto: number; moneda: string; tipo_cambio: number | null };
  factura: ContextoFacturaNotaCredito | null | undefined;
  estado: string;
}

export function NotaCreditoImporte({ nota, factura, estado }: Props) {
  const equivalente = equivalenteNotaCredito(nota, factura);
  const distintaMoneda = factura?.moneda !== nota.moneda;
  const tc = (valor: number) => formatNumber(valor, { decimals: 6 });
  return (
    <div className="flex flex-col tabular-nums">
      <span className="font-medium">{formatCurrency(nota.monto, nota.moneda)}</span>
      {nota.tipo_cambio != null && (
        <span className="text-label text-muted-foreground">TC NC: {tc(nota.tipo_cambio)}</span>
      )}
      {distintaMoneda && (
        <>
          {factura && <span className="text-label text-muted-foreground">Factura: {factura.moneda}</span>}
          {factura?.moneda !== "MXN" && factura?.tipo_cambio_usd != null && (
            <span className="text-label text-muted-foreground">TC factura (referencia): {tc(factura.tipo_cambio_usd)}</span>
          )}
          <span className="text-body-sm text-muted-foreground">
            {equivalente == null || !factura
              ? "Equivalente no disponible: revisa la moneda y el TC guardados."
              : `${estado === "Aplicada" ? "Aplicado" : "Equivalente"}: ${formatCurrency(equivalente, factura.moneda)}`}
          </span>
        </>
      )}
    </div>
  );
}
