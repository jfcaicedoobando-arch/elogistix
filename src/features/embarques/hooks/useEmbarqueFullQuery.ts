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
import { type EmbarqueFullData } from "@/features/embarques/services";
import { embarqueQueries } from "@/features/embarques/queries";

export type { EmbarqueFullData } from "@/features/embarques/services";

export function useEmbarqueFull(id: string | undefined) {
  return useQuery({
    ...embarqueQueries.full(id ?? ""),
    enabled: !!id,
  }) as ReturnType<typeof useQuery<EmbarqueFullData | null>>;
}
