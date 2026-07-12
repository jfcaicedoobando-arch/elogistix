/**
 * Hook: carga la tarifa marítima vinculada a la cotización (si la hay).
 * No mantiene state — sólo react-query. La sincronización con el formulario
 * RHF la hace el panel `TarifaVinculadaPanel` mediante callbacks.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchTarifaVinculada } from "@/features/cotizacion/services/tarifaVinculada";
import type { TopTarifaRow } from "@/features/costeo/types";
import { queryKeys } from "@/lib/query";

export function useTarifaVinculada(tarifaId: string | null) {
  return useQuery<TopTarifaRow | null>({
    queryKey: queryKeys.cotizaciones.tarifaVinculada(tarifaId),
    queryFn: () => (tarifaId ? fetchTarifaVinculada(tarifaId) : Promise.resolve(null)),
    enabled: !!tarifaId,
    staleTime: 60_000,
  });
}
