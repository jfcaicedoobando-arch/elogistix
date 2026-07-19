import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
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

function invalidate(qc: ReturnType<typeof useQueryClient>, facturaId: string | undefined) {
  if (facturaId) qc.invalidateQueries({ queryKey: queryKeys.cxp.notasCredito(facturaId) });
  qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
}

export function useCrearNotaCredito(facturaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesInsert<"proveedor_notas_credito">) =>
      crearNotaCreditoProveedor(payload),
    onSuccess: () => {
      invalidate(qc, facturaId);
      notifySuccess(undefined, { title: "Nota de crédito registrada" });
    },
    onError: (error: Error) => notifyError(undefined, {
      title: `No se pudo registrar la NC: ${error.message}`, error, method: "CREAR_NC_PROVEEDOR",
    }),
  });
}

export function useAplicarNotaCredito(facturaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aplicarNotaCredito(id),
    onSuccess: () => {
      invalidate(qc, facturaId);
      notifySuccess(undefined, { title: "Nota de crédito aplicada" });
    },
    onError: (error: Error) => notifyError(undefined, {
      title: `No se pudo aplicar la NC: ${error.message}`, error, method: "APLICAR_NC_PROVEEDOR",
    }),
  });
}

export function useCancelarNotaCredito(facturaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelarNotaCredito(id),
    onSuccess: () => {
      invalidate(qc, facturaId);
      notifySuccess(undefined, { title: "Nota de crédito cancelada" });
    },
    onError: (error: Error) => notifyError(undefined, {
      title: `No se pudo cancelar la NC: ${error.message}`, error, method: "CANCELAR_NC_PROVEEDOR",
    }),
  });
}
