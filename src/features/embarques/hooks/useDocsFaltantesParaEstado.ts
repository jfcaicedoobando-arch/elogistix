/**
 * Hook que consulta los documentos faltantes para que un embarque
 * avance a un estado destino. Usa la RPC `embarque_docs_faltantes`
 * (fuente única compartida con la auditoría).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Estados en los que faltar documentos BLOQUEA el avance (hard). */
const ESTADOS_BLOQUEANTES = new Set<string>([
  "En Aduana", "Llegada", "Arribo", "Entregado", "EIR", "Cerrado",
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
    queryKey: ["embarque_docs_faltantes", embarqueId, estadoDestino],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc("embarque_docs_faltantes", {
        p_embarque_id: embarqueId!,
        p_estado_destino: estadoDestino!,
      });
      if (error) throw error;
      return (data as string[] | null) ?? [];
    },
    enabled,
    staleTime: 30_000,
  });

  return {
    faltantes: data ?? [],
    bloqueante: esEstadoBloqueante(estadoDestino),
    loading: isLoading,
  };
}
