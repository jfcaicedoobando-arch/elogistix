/**
 * Hooks de React Query para el dashboard del rol Operador.
 * Las queries a Supabase viven en `@/features/embarques/services/dashboardOperador`
 * (regla de capas Pages→Hooks→Services).
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  fetchDocsFaltantesOperador,
  fetchSinTrackingOperador,
  type DocsFaltantesItem,
  type SinTrackingItem,
} from "@/features/embarques/services/dashboardOperador";
import { queryKeys } from "@/lib/query";

export type { DocsFaltantesItem, SinTrackingItem,  };

export function useDocsFaltantesOperador() {
  const { user } = useAuth();
  const email = user?.email ?? null;
  return useQuery<DocsFaltantesItem[]>({
    queryKey: queryKeys.dashboardOperador.docsFaltantes(email),
    enabled: !!email,
    staleTime: 60_000,
    queryFn: () => fetchDocsFaltantesOperador(email!),
  });
}

export function useSinTrackingOperador() {
  const { user } = useAuth();
  const email = user?.email ?? null;
  return useQuery<SinTrackingItem[]>({
    queryKey: queryKeys.dashboardOperador.sinTracking(email),
    enabled: !!email,
    staleTime: 60_000,
    queryFn: () => fetchSinTrackingOperador(email!),
  });
}
