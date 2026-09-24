/**
 * P1-1 (cierre) — Resolución fail-closed de la tarifa vinculada al avanzar.
 *
 * Usa la caché de react-query si existe; en cache miss la consulta (misma
 * query key que el panel). Si no se puede obtener, la coherencia NO se da por
 * buena: se devuelve un error bloqueante en lugar de aceptar cualquier par de IDs.
 */
import type { QueryClient } from "@tanstack/react-query";
import { fetchTarifaVinculada } from "@/features/cotizacion/services/tarifaVinculada";
import { queryKeys } from "@/lib/query";
import { errorCoherenciaRutaTarifa, type PuertosDeTarifa, type RutaConTarifa } from "./coherenciaRutaTarifa";

export const MSG_TARIFA_NO_VERIFICABLE =
  "No pudimos verificar la tarifa vinculada contra la ruta. Revisa tu conexión y vuelve a intentarlo, o elige la tarifa de nuevo.";

type Fetcher = (tarifaId: string) => Promise<PuertosDeTarifa | null>;

export async function resolverPuertosTarifa(
  qc: QueryClient, tarifaId: string, fetcher: Fetcher = fetchTarifaVinculada,
): Promise<PuertosDeTarifa | null> {
  try {
    return await qc.fetchQuery({
      queryKey: queryKeys.cotizaciones.tarifaVinculada(tarifaId),
      queryFn: () => fetcher(tarifaId),
      staleTime: 60_000,
    });
  } catch {
    return null;
  }
}

export async function errorCoherenciaEstricta(
  qc: QueryClient, v: RutaConTarifa, fetcher?: Fetcher,
): Promise<string | null> {
  if (v.modo !== "Marítimo" || !v.tarifaId) return null;
  const tarifa = await resolverPuertosTarifa(qc, v.tarifaId, fetcher);
  if (!tarifa) return MSG_TARIFA_NO_VERIFICABLE;
  return errorCoherenciaRutaTarifa(v, tarifa);
}
