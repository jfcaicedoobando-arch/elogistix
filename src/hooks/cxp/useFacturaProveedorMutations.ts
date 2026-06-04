import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/contexts/AuthContext";
import {
  crearFacturaProveedor,
  actualizarFacturaProveedor,
  softDeleteFacturaProveedor,
} from "@/services/cxp";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export function useCrearFacturaProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesInsert<"proveedor_facturas">) => crearFacturaProveedor(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cxp.all }),
  });
}

export function useActualizarFacturaProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TablesUpdate<"proveedor_facturas"> }) =>
      actualizarFacturaProveedor(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cxp.all }),
  });
}

export function useEliminarFacturaProveedor() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => softDeleteFacturaProveedor(id, user?.id ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cxp.all }),
  });
}
