/**
 * KPIs del encabezado de una factura de proveedor (recibida).
 */
import type { DocumentoKpi } from "@/components/shared/documento/DocumentoKpiStrip";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";

export function buildKpisFacturaProveedor(f: FacturaCxP): DocumentoKpi[] {
  const cancelada = f.estado === "Cancelada";
  const conSaldo = !cancelada && f.saldo > 0.01;
  const vencida = !cancelada && f.dias_vencido > 0 && conSaldo;

  return [
    { label: "Total factura", value: formatCurrency(f.total, f.moneda) },
    {
      label: "Pagado",
      value: formatCurrency(f.pagado, f.moneda),
      tone: !conSaldo && f.pagado > 0 ? "success" : "default",
    },
    {
      label: "Saldo pendiente",
      value: formatCurrency(cancelada ? 0 : f.saldo, f.moneda),
      tone: conSaldo ? "warning" : "default",
    },
    {
      label: "Vencimiento",
      value: f.fecha_vencimiento ? formatDate(f.fecha_vencimiento) : "—",
      tone: vencida ? "destructive" : "default",
      hint: vencida ? `${f.dias_vencido} días vencida` : `${f.dias_credito ?? 0} días de crédito`,
    },
  ];
}
