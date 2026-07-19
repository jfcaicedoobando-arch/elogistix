import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchGarantiasEmbarque, updateGarantia, type UpdateGarantiaInput } from "../services/garantias";

import { notifyError } from "@/components/shared/utils/appFeedback";
import { queryKeys } from "@/lib/query";
export function useGarantiasContenedor(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.garantias(embarqueId),
    queryFn: () => fetchGarantiasEmbarque(embarqueId!),
    enabled: !!embarqueId,
  });
}

export function useUpdateGarantia(embarqueId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateGarantiaInput) => updateGarantia(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.garantias(embarqueId) });
      toast.success("Garantía actualizada");
    },
    onError: (e: unknown) => {
      // Fase P.2 — el service ya devuelve GarantiaError con mensaje en español mexicano.
      const msg = e instanceof Error ? e.message : "Error al actualizar la garantía";
      notifyError(toast, { title: msg, error: e, method: "FEATURES_EMBARQUES_HOOKS_USEGARANTIASCONTENEDOR_1" });
    },
  });
}
