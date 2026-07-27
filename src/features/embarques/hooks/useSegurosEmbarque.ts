import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  createSeguroEmbarque,
  deleteSeguroEmbarque,
  fetchSegurosEmbarque,
  updateSeguroEmbarque,
  type SeguroEmbarque,
  type SeguroEmbarqueInput,
} from "@/features/embarques/services/seguros";
import { queryKeys } from "@/lib/query";

const KEY = queryKeys.embarques.seguros;

export function useSegurosEmbarque(embarqueId: string | undefined) {
  return useQuery<SeguroEmbarque[]>({
    queryKey: KEY(embarqueId),
    queryFn: () => fetchSegurosEmbarque(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
}

function invalidatePnl(qc: ReturnType<typeof useQueryClient>, embarqueId?: string) {
  qc.invalidateQueries({ queryKey: KEY(embarqueId) });
  qc.invalidateQueries({ queryKey: queryKeys.embarques.pnlFinanciero(embarqueId) });
}

export function useCreateSeguro(embarqueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SeguroEmbarqueInput) => createSeguroEmbarque(input),
    onSuccess: () => {
      invalidatePnl(qc, embarqueId);
      notifySuccess(undefined, { title: "Póliza registrada" });
    },
    onError: (e: Error) => notifyError(undefined, { title: e.message ?? "No se pudo guardar la póliza", error: e, method: "FEATURES_EMBARQUES_HOOKS_USESEGUROSEMBARQUE_1" }),
  });
}

export function useUpdateSeguro(embarqueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Partial<SeguroEmbarqueInput> }) =>
      updateSeguroEmbarque(vars.id, vars.patch),
    onSuccess: () => {
      invalidatePnl(qc, embarqueId);
      notifySuccess(undefined, { title: "Póliza actualizada" });
    },
    onError: (e: Error) => notifyError(undefined, { title: e.message ?? "No se pudo actualizar la póliza", error: e, method: "FEATURES_EMBARQUES_HOOKS_USESEGUROSEMBARQUE_2" }),
  });
}

export function useDeleteSeguro(embarqueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSeguroEmbarque(id),
    onSuccess: () => {
      invalidatePnl(qc, embarqueId);
      notifySuccess(undefined, { title: "Póliza eliminada" });
    },
    onError: (e: Error) => notifyError(undefined, { title: e.message ?? "No se pudo eliminar la póliza", error: e, method: "FEATURES_EMBARQUES_HOOKS_USESEGUROSEMBARQUE_3" }),
  });
}
