import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchGarantiasEmbarque,
  refrescarGarantiasDesdeTarifa,
  updateGarantia,
  type UpdateGarantiaInput,
} from "../services/garantias";

import { notifyError } from "@/lib/ui/appFeedback";
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
      const msg = e instanceof Error ? e.message : "Error al actualizar la garantía";
      notifyError(toast, { title: msg, error: e, method: "FEATURES_EMBARQUES_HOOKS_USEGARANTIASCONTENEDOR_1" });
    },
  });
}

export function useRefrescarGarantiasDesdeTarifa(embarqueId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => refrescarGarantiasDesdeTarifa(embarqueId!),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.garantias(embarqueId) });
      if (updated > 0) {
        toast.success(`${updated} garantía${updated === 1 ? "" : "s"} precargada${updated === 1 ? "" : "s"} desde la tarifa`);
      } else {
        toast.info("No hay tarifa ni condición de naviera configurada para precargar");
      }
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Error al precargar desde la tarifa";
      notifyError(toast, { title: msg, error: e, method: "FEATURES_EMBARQUES_HOOKS_USEGARANTIASCONTENEDOR_2" });
    },
  });
}

