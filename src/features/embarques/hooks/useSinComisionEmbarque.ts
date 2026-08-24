/**
 * v13.386.0 — Estado y edición de la exclusión de comisión del embarque.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";
import {
  fetchSinComisionEmbarque,
  setSinComisionEmbarque,
  type SinComisionOverride,
} from "@/features/embarques/services/comisionExclusion";

export function useSinComisionEmbarque(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.sinComision(embarqueId),
    queryFn: () => fetchSinComisionEmbarque(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
}

interface Input {
  embarqueId: string;
  valor: SinComisionOverride;
}

export function useSetSinComisionEmbarque() {
  const qc = useQueryClient();
  return useMutationWithFeedback<unknown, Error, Input>({
    mutationFn: ({ embarqueId, valor }: Input) => setSinComisionEmbarque(embarqueId, valor),
    invalidate: [queryKeys.embarques.all, queryKeys.comisiones.all],
    // B-1: la query vive en el árbol singular ['embarque', id, 'sin-comision'],
    // que el prefijo plural ['embarques'] NO cubre — sin esta invalidación el
    // Select de ComisionEmbarqueCard volvía al valor viejo tras guardar.
    onSuccess: (_data, { embarqueId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.sinComision(embarqueId) });
    },
    successTitle: "Regla de comisión actualizada",
    errorTitle: "Error al actualizar la regla de comisión",
    errorMethod: "SET_SIN_COMISION_EMBARQUE",
  });
}
