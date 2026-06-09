/**
 * Hook para crear cotizaciones informativas (tarifarios).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { crearCotizacionInformativa } from "@/services/cotizacion/informativa";
import type { CotizacionInformativaInput } from "@/types/cotizacionInformativa";

export function useCreateCotizacionInformativa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CotizacionInformativaInput) => crearCotizacionInformativa(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}
