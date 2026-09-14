import { sumarFacturasPorMoneda, type FacturaSumable } from "@/features/facturacion/utils/sumarFacturas";
import { formatCurrency } from "@/lib/formatters";

export function subtotalesVigentesFacturas(facturas: FacturaSumable[]): string[] {
  const resumen = sumarFacturasPorMoneda(facturas);
  return [
    resumen.totalMxn > 0 ? formatCurrency(resumen.totalMxn, "MXN") : null,
    resumen.totalUsd > 0 ? formatCurrency(resumen.totalUsd, "USD") : null,
  ].filter((subtotal): subtotal is string => subtotal !== null);
}