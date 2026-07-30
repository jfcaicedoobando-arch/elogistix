/**
 * KPIs del encabezado de una factura emitida: total, cobrado, saldo y
 * vencimiento. Sólo formato — no calcula reglas de negocio nuevas.
 */
import type { DocumentoKpi } from "@/components/shared/documento/DocumentoKpiStrip";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";

export function buildKpisFactura(factura: FacturaDetalle, saldo?: number): DocumentoKpi[] {
  const total = Number(factura.total ?? 0);
  const cancelada = factura.estado === "Cancelada";
  const saldoNum = typeof saldo === "number" ? saldo : total;
  const cobrado = Math.max(total - saldoNum, 0);
  const conSaldo = !cancelada && saldoNum > 0.005;

  return [
    { label: "Total", value: formatCurrency(total, factura.moneda) },
    {
      label: "Cobrado",
      value: formatCurrency(cancelada ? 0 : cobrado, factura.moneda),
      tone: !conSaldo && cobrado > 0 ? "success" : "default",
    },
    {
      label: "Saldo",
      value: formatCurrency(cancelada ? 0 : saldoNum, factura.moneda),
      tone: conSaldo ? "warning" : "default",
    },
    {
      label: "Vencimiento",
      value: factura.fecha_vencimiento ? formatDate(factura.fecha_vencimiento) : "—",
      tone: factura.estado === "Vencida" ? "destructive" : "default",
      hint: `${factura.dias_credito ?? 0} días de crédito`,
    },
  ];
}
