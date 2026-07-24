import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationWithFeedback } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import {
  aplicarNotaCredito,
  aprobarNotaCredito,
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

/**
 * Invalida ambas caches: la lista de NCs del facturaId y el árbol `cxp.all`.
 * El wrapper solo acepta keys estáticas, así que el invalidate específico por
 * factura se hace vía `onSuccess` extra (facturaId está fuera de las vars).
 */
function useInvalidateNc(facturaId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    if (facturaId) qc.invalidateQueries({ queryKey: queryKeys.cxp.notasCredito(facturaId) });
  };
}

export function useCrearNotaCredito(facturaId: string | undefined) {
  const invalidateNc = useInvalidateNc(facturaId);
  return useMutationWithFeedback({
    mutationFn: (payload: TablesInsert<"proveedor_notas_credito">) =>
      crearNotaCreditoProveedor(payload),
    invalidate: queryKeys.cxp.all,
    successTitle: "Nota de crédito registrada",
    errorTitle: "No se pudo registrar la NC",
    errorMethod: "CREAR_NC_PROVEEDOR",
    onSuccess: () => invalidateNc(),
  });
}

export function useAplicarNotaCredito(facturaId: string | undefined) {
  const invalidateNc = useInvalidateNc(facturaId);
  return useMutationWithFeedback({
    mutationFn: (id: string) => aplicarNotaCredito(id),
    invalidate: queryKeys.cxp.all,
    successTitle: "Nota de crédito aplicada",
    errorTitle: "No se pudo aplicar la NC",
    errorMethod: "APLICAR_NC_PROVEEDOR",
    onSuccess: () => invalidateNc(),
  });
}

export function useAprobarNotaCredito(facturaId: string | undefined) {
  const invalidateNc = useInvalidateNc(facturaId);
  return useMutationWithFeedback({
    mutationFn: (id: string) => aprobarNotaCredito(id),
    invalidate: queryKeys.cxp.all,
    successTitle: "Nota de crédito aprobada",
    errorTitle: "No se pudo aprobar la NC",
    errorMethod: "APROBAR_NC_PROVEEDOR",
    onSuccess: () => invalidateNc(),
  });
}

export function useCancelarNotaCredito(facturaId: string | undefined) {
  const invalidateNc = useInvalidateNc(facturaId);
  return useMutationWithFeedback({
    mutationFn: (id: string) => cancelarNotaCredito(id),
    invalidate: queryKeys.cxp.all,
    successTitle: "Nota de crédito cancelada",
    errorTitle: "No se pudo cancelar la NC",
    errorMethod: "CANCELAR_NC_PROVEEDOR",
    onSuccess: () => invalidateNc(),
  });
}
