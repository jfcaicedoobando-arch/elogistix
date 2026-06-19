import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchGarantiasEmbarque, updateGarantia, type UpdateGarantiaInput } from "../services/garantias";

import { notifyError } from "@/components/shared/utils/appFeedback";
export function useGarantiasContenedor(embarqueId: string | undefined) {
  return useQuery({
    queryKey: ["garantias-embarque", embarqueId],
    queryFn: () => fetchGarantiasEmbarque(embarqueId!),
    enabled: !!embarqueId,
  });
}

export function useUpdateGarantia(embarqueId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateGarantiaInput) => updateGarantia(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["garantias-embarque", embarqueId] });
      toast.success("Garantía actualizada");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Error al actualizar";
      notifyError(toast, { title: msg, error: e, method: "FEATURES_EMBARQUES_HOOKS_USEGARANTIASCONTENEDOR_1" });
    },
  });
}
