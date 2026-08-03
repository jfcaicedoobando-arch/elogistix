/**
 * KPIs de totales del formulario de captura de factura de proveedor.
 * Extraído en v13.366.0 para bajar la complejidad del diálogo.
 */
import { formatCurrency } from "@/lib/formatters";
import { Kpi } from "./DialogDetallePagosProveedor.parts";

interface Props {
  subtotal: number;
  iva: number;
  ieps: number;
  retenciones: number;
  total: number;
  moneda: string;
}

export function FacturaProveedorTotalesKpis({
  subtotal, iva, ieps, retenciones, total, moneda,
}: Props) {
  const conIeps = ieps > 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      <Kpi label="Subtotal" value={formatCurrency(subtotal, moneda)} />
      <Kpi label="IVA" value={formatCurrency(iva, moneda)} />
      <Kpi
        label={conIeps ? "IEPS" : "Retenciones"}
        value={formatCurrency(conIeps ? ieps : retenciones, moneda)}
      />
      <Kpi label={`Total ${moneda}`} value={formatCurrency(total, moneda)} emphasis />
    </div>
  );
}
