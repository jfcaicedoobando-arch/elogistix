import { formatCurrency } from "@/lib/formatters";

interface Props {
  totalUSD: number;
  totalMXN: number;
  /** B-101: ocultar la línea de una moneda sin conceptos (default: visible,
   *  para no cambiar los call-sites internos existentes). */
  mostrarUSD?: boolean;
  mostrarMXN?: boolean;
  /** B-081: cuando el caller desglosa el IVA por moneda, la nota al pie
   *  refleja el cálculo real en lugar de afirmar que solo MXN lleva IVA. */
  ivaUSD?: number;
  ivaMXN?: number;
}

export default function ResumenTotalesCotizacion({
  totalUSD,
  totalMXN,
  mostrarUSD = true,
  mostrarMXN = true,
  ivaUSD,
  ivaMXN,
}: Props) {
  const monedasConIva = ivaUSD !== undefined || ivaMXN !== undefined
    ? [
        ivaUSD != null && ivaUSD > 0 ? "USD" : null,
        mostrarMXN && (ivaMXN == null || ivaMXN > 0) ? "MXN" : null,
      ].filter(Boolean).join(" y ")
    : null;
  return (
    <div className="flex flex-col items-end gap-1 p-4 border rounded-md bg-muted/30">
      {mostrarUSD && (
        <span className="text-base font-bold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
      )}
      {mostrarMXN && (
        <span className="text-base font-bold">Total MXN (c/IVA): {formatCurrency(totalMXN, 'MXN')}</span>
      )}
      <span className="text-xs text-muted-foreground">
        {monedasConIva
          ? `* Los conceptos en ${monedasConIva} incluyen IVA según la tasa de cada concepto`
          : "* Los conceptos en MXN incluyen IVA 16%"}
      </span>
    </div>
  );
}
