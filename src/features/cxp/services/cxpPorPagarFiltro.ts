/**
 * Selector compartido: ¿una factura de CxP cuenta como "por pagar"?
 *
 * Usado tanto por el KPI "Por pagar 30d" (cxpKpis.ts) como por el widget
 * "Top 10 próximas a pagar" (useFinanceDashboard.ts). Antes tenían criterios
 * distintos: el KPI sumaba cualquier estatus salvo Rechazada/Cancelada
 * (incluyendo "Por aprobar"), pero el widget sólo mostraba "Por vencer" y
 * "Vencida", por lo que podía anunciar "Nada por pagar 🎉" mientras el KPI
 * reportaba un saldo > 0 (Q-15.6).
 */
import type { FacturaCxP } from "./proveedorFacturas";

export function esFacturaPorPagar(f: Pick<FacturaCxP, "saldo" | "estatus">): boolean {
  if (f.saldo <= 0) return false;
  return f.estatus !== "Rechazada" && f.estatus !== "Cancelada";
}
