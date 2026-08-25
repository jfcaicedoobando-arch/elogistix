/**
 * Hook: columnas internas de un embarque (delta de tarifa, snapshot de cierre,
 * motivo de reapertura y correo del creador).
 *
 * La tabla `embarques` ya no expone estas columnas a `authenticated`; se leen
 * por la vista `embarques_interno_v`, que sólo devuelve fila para staff de la
 * organización. Para usuarios de portal el resultado es `null`.
 */
import { useQuery } from "@tanstack/react-query";
import {
  obtenerEmbarqueInterno,
  type EmbarqueInterno,
} from "@/features/embarques/services/internoEmbarque";
import { queryKeys } from "@/lib/query";

export type { EmbarqueInterno } from "@/features/embarques/services/internoEmbarque";

export function useEmbarqueInterno(embarqueId: string | undefined) {
  return useQuery<EmbarqueInterno | null>({
    queryKey: queryKeys.embarques.interno(embarqueId),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
    queryFn: () => obtenerEmbarqueInterno(embarqueId as string),
  });
}
