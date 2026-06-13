import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  listarPagosFactura,
  registrarPagoFactura,
  eliminarPagoFactura,
  type RegistrarPagoInput,
} from "@/services/pagos-factura";

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
}

export function useRegistrarPagoFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegistrarPagoInput) => registrarPagoFactura(input),
    onSuccess: (_d, vars) => invalidarFacturasYPagos(qc, vars.factura_id),
  });
}

export function useEliminarPagoFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; facturaId: string }) => eliminarPagoFactura(params.id),
    onSuccess: (_d, vars) => invalidarFacturasYPagos(qc, vars.facturaId),
  });
}
