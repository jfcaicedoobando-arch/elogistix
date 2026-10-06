import { queryKeys } from "@/lib/query";

/** Read models affected by REP state, owned by the operation coordinator.
 * Identity stays unchanged; pending/error reconciliation uses the same effects.
 * Recording a payment has its own invalidation and must not depend on REP success.
 */
export function lecturasAfectadasPorRep(facturaId?: string) {
  return [
    ...(facturaId
      ? [queryKeys.facturas.pagos(facturaId), queryKeys.facturas.detail(facturaId)]
      : [queryKeys.facturas.pagosAll]),
    queryKeys.facturas.all,
    queryKeys.facturacion.repPendientes,
    queryKeys.bandejas.all,
    queryKeys.dashboardEjecutivo.all,
    queryKeys.presupuesto.all,
    queryKeys.profit.all,
    queryKeys.direccion.all,
  ];
}
