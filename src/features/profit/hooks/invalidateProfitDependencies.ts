/**
 * Helper para invalidar las queries del módulo Profit cuando cambian datos
 * transaccionales (facturas, pagos, embarques, gastos de proveedor). Se llama
 * desde mutaciones críticas para evitar dashboards financieros stale.
 *
 * Se prefiere una función centralizada para no duplicar la lista de keys en
 * cada `onSuccess` y para que futuros consumidores de Profit se enteren aquí.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";

export function invalidateProfitDependencies(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: queryKeys.dashboardEjecutivo.all });
  qc.invalidateQueries({ queryKey: queryKeys.presupuesto.all });
  qc.invalidateQueries({ queryKey: queryKeys.profit.all });
  // Defecto 6 (v13.823.43): el tablero de Dirección lee cartera/cobrado de las
  // mismas tablas; sin esto conservaba cifras previas tras registrar un pago.
  qc.invalidateQueries({ queryKey: queryKeys.direccion.all });
}
