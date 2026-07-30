/**
 * KPIs del encabezado de una factura de proveedor (recibida).
 * v13.350.0: delega en el constructor compartido `buildKpisDocumento`.
 */
import type { DocumentoKpi } from "@/components/shared/documento/DocumentoKpiStrip";
import { buildKpisDocumento } from "@/lib/domain/documentoKpis";
import type { FacturaCxP } from "@/features/cxp/services";

export function buildKpisFacturaProveedor(f: FacturaCxP): DocumentoKpi[] {
  return buildKpisDocumento({
    total: f.total,
    pagado: f.pagado,
    saldo: f.saldo,
    moneda: f.moneda,
    cancelada: f.estado === "Cancelada",
    fechaVencimiento: f.fecha_vencimiento,
    diasCredito: f.dias_credito,
    diasVencido: f.dias_vencido,
    etiquetaPagado: "Pagado",
  });
}
