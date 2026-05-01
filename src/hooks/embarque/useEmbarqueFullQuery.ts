/**
 * Hook unificado: trae en UNA sola llamada al backend (RPC `get_embarque_full`)
 * todo lo necesario para la página de detalle de un embarque:
 *   - embarque (datos generales)
 *   - conceptosVenta, conceptosCosto
 *   - documentos, notas, facturas
 *
 * Reemplaza 6 useQuery individuales por 1, reduciendo round-trips a Lovable Cloud.
 * Los hooks individuales (`useEmbarqueConceptosVenta`, etc.) siguen disponibles para
 * lugares que invalidan/mutan una sola sub-entidad.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchEmbarqueFull, type EmbarqueFullData } from "@/services/embarque";
import { queryKeys } from "@/lib/query";

export type { EmbarqueFullData } from "@/services/embarque";

export function useEmbarqueFull(id: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.embarques.all, "full", id],
    queryFn: () => fetchEmbarqueFull(id!),
    enabled: !!id,
    staleTime: 30_000,
  }) as ReturnType<typeof useQuery<EmbarqueFullData | null>>;
}
