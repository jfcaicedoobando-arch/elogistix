import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";
import {
  listarPagosFactura,
  registrarPagoFactura,
  eliminarPagoFactura,
  type RegistrarPagoInput,
} from "@/features/facturacion/services/pagos";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export function usePagosFactura(facturaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.facturas.pagos(facturaId ?? ""),
    queryFn: () => listarPagosFactura(facturaId!),
    enabled: !!facturaId,
  });
}

function invalidarFacturasYPagos(qc: ReturnType<typeof useQueryClient>, facturaId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
  qc.invalidateQueries({ queryKey: queryKeys.facturas.pagos(facturaId) });
  // Registrar/eliminar un pago impacta cartera vencida e ingresos cobrados
  // (Dashboard Ejecutivo, EERR, Presupuesto vs Real). v13.300.33.
  // A8: el aging CxC y la cartera pendiente cambian con cada abono — antes
  // quedaban obsoletos hasta que vencía el staleTime.
  qc.invalidateQueries({ queryKey: queryKeys.cxc.all });
  qc.invalidateQueries({ queryKey: queryKeys.bandejas.carteraPendiente });
  invalidateProfitDependencies(qc);
}

// NOTA: el dialog `DialogRegistrarPago` ya muestra su propio toast de éxito
// vía notifySuccess en el catch del componente. Aquí sólo añadimos onError
// como red de seguridad para llamadas desde otros consumidores.
export function useRegistrarPagoFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegistrarPagoInput) => registrarPagoFactura(input),
    onSuccess: (_d, vars) => invalidarFacturasYPagos(qc, vars.factura_id),
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al registrar pago: ${error.message}`, error, method: "REGISTER_PAYMENT" });
    },
  });
}

export function useEliminarPagoFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; facturaId: string }) => eliminarPagoFactura(params.id),
    onSuccess: (_d, vars) => {
      invalidarFacturasYPagos(qc, vars.facturaId);
      notifySuccess(undefined, { title: "Pago eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar pago: ${error.message}`, error, method: "DELETE_PAYMENT" });
    },
  });
}
