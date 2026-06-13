import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/contexts/AuthContext";
import {
  crearFacturaProveedor,
  softDeleteFacturaProveedor,
} from "@/features/cxp/services";
import type { TablesInsert } from "@/integrations/supabase/types";

export function useCrearFacturaProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesInsert<"proveedor_facturas">) => crearFacturaProveedor(payload),
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
