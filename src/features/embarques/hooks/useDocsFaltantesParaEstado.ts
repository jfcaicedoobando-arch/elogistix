/**
 * Hook que consulta los documentos faltantes para que un embarque
 * avance a un estado destino. Usa la RPC `embarque_docs_faltantes`
 * (fuente única compartida con la auditoría) vía servicio.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchDocsFaltantesParaEstado } from "@/features/embarques/services/docsFaltantes";
import { queryKeys } from "@/lib/query";

/** Estados en los que faltar documentos BLOQUEA el avance (hard). */
// v13.303.22 — `Llegada` deprecado; se mantiene por retro-compatibilidad.
const ESTADOS_BLOQUEANTES = new Set<string>([
  "En Tránsito", "Arribo", "En Aduana", "Llegada", "Entregado", "EIR",
  "Por liquidar", "Cerrado",
]);

export function esEstadoBloqueante(estado: string | null | undefined): boolean {
  return !!estado && ESTADOS_BLOQUEANTES.has(estado);
}

export interface DocsFaltantesParaEstado {
  faltantes: string[];
  bloqueante: boolean;
  loading: boolean;
}

export function useDocsFaltantesParaEstado(
  embarqueId: string | undefined,
  estadoDestino: string | null,
): DocsFaltantesParaEstado {
  const enabled = !!embarqueId && !!estadoDestino;
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.embarques.docsFaltantes(embarqueId, estadoDestino),
    queryFn: () => fetchDocsFaltantesParaEstado(embarqueId!, estadoDestino!),
    enabled,
    staleTime: 30_000,
  });

  return {
    faltantes: data ?? [],
    bloqueante: esEstadoBloqueante(estadoDestino),
    loading: isLoading,
  };
}
