import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query";
import {
  aplicarNotaCredito,
  cancelarNotaCredito,
  crearNotaCreditoProveedor,
  fetchNotasCreditoFactura,
} from "@/features/cxp/services/proveedorNotasCredito";
import type { TablesInsert } from "@/integrations/supabase/types";

export function useNotasCreditoFactura(facturaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cxp.notasCredito(facturaId ?? ""),
    queryFn: () => fetchNotasCreditoFactura(facturaId as string),
    enabled: !!facturaId,
    staleTime: 30_000,
  });
}

export function useCrearNotaCredito(facturaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesInsert<"proveedor_notas_credito">) =>
      crearNotaCreditoProveedor(payload),
    onSuccess: () => {
      if (facturaId) qc.invalidateQueries({ queryKey: queryKeys.cxp.notasCredito(facturaId) });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      toast.success("Nota de crédito registrada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo registrar la NC"),
  });
}

export function useAplicarNotaCredito(facturaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aplicarNotaCredito(id),
    onSuccess: () => {
      if (facturaId) qc.invalidateQueries({ queryKey: queryKeys.cxp.notasCredito(facturaId) });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      toast.success("Nota de crédito aplicada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo aplicar la NC"),
  });
}

export function useCancelarNotaCredito(facturaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelarNotaCredito(id),
    onSuccess: () => {
      if (facturaId) qc.invalidateQueries({ queryKey: queryKeys.cxp.notasCredito(facturaId) });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      toast.success("Nota de crédito cancelada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo cancelar la NC"),
  });
}
