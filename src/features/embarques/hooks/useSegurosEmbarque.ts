import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createSeguroEmbarque,
  deleteSeguroEmbarque,
  fetchSegurosEmbarque,
  updateSeguroEmbarque,
  type SeguroEmbarque,
  type SeguroEmbarqueInput,
} from "@/features/embarques/services/seguros";

const KEY = (embarqueId?: string) => ["embarque", embarqueId, "seguros"] as const;

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
  qc.invalidateQueries({ queryKey: ["embarque", embarqueId, "pnl-financiero"] });
}

export function useCreateSeguro(embarqueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SeguroEmbarqueInput) => createSeguroEmbarque(input),
    onSuccess: () => {
      invalidatePnl(qc, embarqueId);
      toast.success("Póliza registrada");
    },
    onError: (e: Error) => toast.error(e.message ?? "No se pudo guardar la póliza"),
  });
}

export function useUpdateSeguro(embarqueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Partial<SeguroEmbarqueInput> }) =>
      updateSeguroEmbarque(vars.id, vars.patch),
    onSuccess: () => {
      invalidatePnl(qc, embarqueId);
      toast.success("Póliza actualizada");
    },
    onError: (e: Error) => toast.error(e.message ?? "No se pudo actualizar la póliza"),
  });
}

export function useDeleteSeguro(embarqueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSeguroEmbarque(id),
    onSuccess: () => {
      invalidatePnl(qc, embarqueId);
      toast.success("Póliza eliminada");
    },
    onError: (e: Error) => toast.error(e.message ?? "No se pudo eliminar la póliza"),
  });
}
