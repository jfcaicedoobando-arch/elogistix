import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  listarPagosProveedor,
  registrarPagoProveedor,
  eliminarPagoProveedor,
  type RegistrarPagoProveedorInput,
} from "@/features/cxp/services";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { traducirErrorPagoProveedor } from "@/features/cxp/services/pagosProveedorErrors";

export function usePagosProveedor(facturaId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.cxp.pagos(facturaId ?? ""),
    queryFn: () => listarPagosProveedor(facturaId!),
    enabled: !!facturaId,
    staleTime: 30_000,
  });
}

export function useRegistrarPagoProveedor() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: RegistrarPagoProveedorInput) =>
      registrarPagoProveedor(input, user?.id ?? null),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.pagos(vars.proveedor_factura_id) });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      notifySuccess(undefined, { title: "Pago a proveedor registrado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: traducirErrorPagoProveedor(error), error, method: "REGISTER_PAYMENT_PROVEEDOR" });
    },
  });
}

export function useEliminarPagoProveedor(facturaId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (pagoId: string) => eliminarPagoProveedor(pagoId, facturaId, user?.id ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.pagos(facturaId) });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      notifySuccess(undefined, { title: "Pago a proveedor eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: traducirErrorPagoProveedor(error), error, method: "DELETE_PAYMENT_PROVEEDOR" });
    },
  });
}
