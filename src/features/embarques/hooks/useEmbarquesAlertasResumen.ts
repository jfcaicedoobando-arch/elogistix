/**
 * v13.142.3 — Hook con el desglose de las alertas que alimentan el badge
 * "Embarques · N" del sidebar (demoras, garantías atoradas, cierre admin
 * pendiente). Lo consume el panel `EmbarquesAlertasPanel` y el filtro
 * `?alerta=` del listado.
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchEmbarquesAlertasResumen,
  type EmbarquesAlertasResumen,
} from "@/features/embarques/services/alertas";
import { queryKeys } from "@/lib/query";

const EMPTY: EmbarquesAlertasResumen = {
  demora: new Set<string>(),
  garantia: new Set<string>(),
  admin_pendiente: new Set<string>(),
  total: 0,
};

export function useEmbarquesAlertasResumen() {
  const query = useQuery({
    queryKey: queryKeys.embarques.alertasResumen(),
    queryFn: fetchEmbarquesAlertasResumen,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  return {
    ...query,
    data: query.data ?? EMPTY,
  };
}
