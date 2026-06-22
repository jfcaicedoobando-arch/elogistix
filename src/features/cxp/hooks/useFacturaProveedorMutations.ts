import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  crearFacturaProveedor,
  softDeleteFacturaProveedor,
  actualizarFacturaProveedor,
  SaldoNegativoError,
  type ActualizarFacturaPayload,
  type NuevaFacturaProveedorPayload,
} from "@/features/cxp/services";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

export function useCrearFacturaProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: NuevaFacturaProveedorPayload) => crearFacturaProveedor(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      notifySuccess(undefined, { title: "Factura de proveedor creada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear factura proveedor: ${error.message}`, error, method: "CREATE_FACTURA_PROVEEDOR" });
    },
  });
}

export function useEliminarFacturaProveedor() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => softDeleteFacturaProveedor(id, user?.id ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      notifySuccess(undefined, { title: "Factura de proveedor eliminada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar factura proveedor: ${error.message}`, error, method: "DELETE_FACTURA_PROVEEDOR" });
    },
  });
}

export function useActualizarFacturaProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ActualizarFacturaPayload }) =>
      actualizarFacturaProveedor(id, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.factura(vars.id) });
      qc.invalidateQueries({ queryKey: ["cxp", "historial", vars.id] });
      qc.invalidateQueries({ queryKey: ["bandejas", "cxp"] });
      notifySuccess(undefined, { title: "Factura de proveedor actualizada" });
    },
    onError: (error: Error) => {
      const code = (error as Error & { code?: string }).code;
      if (error instanceof SaldoNegativoError || code === "SALDO_NEGATIVO") {
        notifyError(undefined, { title: "El nuevo total no puede ser menor a lo ya pagado", error, method: "UPDATE_FACTURA_PROVEEDOR_SALDO" });
        return;
      }
      if (code === "DUPLICADO") {
        notifyError(undefined, { title: "Folio duplicado para este proveedor y fecha", error, method: "UPDATE_FACTURA_PROVEEDOR_DUP" });
        return;
      }
      notifyError(undefined, { title: `Error al actualizar factura: ${error.message}`, error, method: "UPDATE_FACTURA_PROVEEDOR" });
    },
  });
}
