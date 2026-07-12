/**
 * Suscribe al estado auth y expone si el usuario actual está en la org demo.
 * Fase 1 (13.271.0): migrado a `useQuery` — el estado del check se comparte
 * entre componentes que consumen el hook (cache por userId), y respeta el
 * ciclo `enabled` para evitar el RPC cuando no hay usuario.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { fetchIsDemoUser } from "@/features/marketing/services/demoMode";
import { queryKeys } from "@/lib/query";

const STALE_TIME_MS = 5 * 60 * 1000; // 5 min — flag rara vez cambia dentro de una sesión.

export function useIsDemoUser(): boolean {
  const { user } = useAuth();
  const userId = user?.id;

  const { data } = useQuery({
    queryKey: queryKeys.marketing.isDemoUser(userId),
    queryFn: () => fetchIsDemoUser(userId!),
    enabled: Boolean(userId),
    staleTime: STALE_TIME_MS,
    gcTime: STALE_TIME_MS,
  });

  return Boolean(data);
}
