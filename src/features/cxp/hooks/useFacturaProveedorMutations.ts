import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  crearFacturaProveedor,
  softDeleteFacturaProveedor,
} from "@/features/cxp/services";
import type { TablesInsert } from "@/integrations/supabase/types";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

export function useCrearFacturaProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesInsert<"proveedor_facturas">) => crearFacturaProveedor(payload),
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
