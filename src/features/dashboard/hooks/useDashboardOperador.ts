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
  type OperadorEmbarqueLite,
} from "@/features/embarques/services/dashboardOperador";

export type { DocsFaltantesItem, SinTrackingItem, OperadorEmbarqueLite };

export function useDocsFaltantesOperador() {
  const { user } = useAuth();
  const email = user?.email ?? null;
  return useQuery<DocsFaltantesItem[]>({
    queryKey: ["dashboard-operador", "docs-faltantes", email],
    enabled: !!email,
    staleTime: 60_000,
    queryFn: () => fetchDocsFaltantesOperador(email!),
  });
}

export function useSinTrackingOperador() {
  const { user } = useAuth();
  const email = user?.email ?? null;
  return useQuery<SinTrackingItem[]>({
    queryKey: ["dashboard-operador", "sin-tracking", email],
    enabled: !!email,
    staleTime: 60_000,
    queryFn: () => fetchSinTrackingOperador(email!),
  });
}
