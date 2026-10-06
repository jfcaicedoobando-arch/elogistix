/**
 * KPIs del encabezado de una factura emitida.
 * v13.350.0: delega en el constructor compartido `buildKpisDocumento`
 * para que emitidas y recibidas usen las mismas etiquetas y tonos.
 */
import type { DocumentoKpi } from "@/lib/domain/documentoKpis";
import { buildKpisDocumento } from "@/lib/domain/documentoKpis";
import type { FacturaDetalle } from "@/features/facturacion/types";

type FacturaKpisInput = Pick<FacturaDetalle, "total" | "estado" | "moneda" | "fecha_vencimiento" | "dias_credito">;

export function buildKpisFactura(factura: FacturaKpisInput, saldo?: number, cobrado = 0): DocumentoKpi[] {
  const total = Number(factura.total ?? 0);
  const saldoNum = typeof saldo === "number" ? saldo : total;
  const cancelada = factura.estado === "Cancelada";

  return buildKpisDocumento({
    total,
    // Una nota de crédito reduce saldo, pero no representa dinero cobrado.
    pagado: Math.max(cobrado, 0),
    saldo: saldoNum,
    moneda: factura.moneda,
    cancelada,
    fechaVencimiento: factura.fecha_vencimiento,
    diasCredito: factura.dias_credito,
    diasVencido: factura.estado === "Vencida" ? 1 : 0,
    etiquetaPagado: "Cobrado",
  });
}
