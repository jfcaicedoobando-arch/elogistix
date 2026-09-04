/**
 * Hooks consolidados para el Dashboard del CRM.
 * I/O delegada a `services/crm/dashboard` y `services/crm/actividades`.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import { fetchCrmDashboard, type CrmDashboardData } from "@/features/crm/services/dashboard";
import {
  countActividadesVencidas,
  listActividadesVencidas,
} from "@/features/crm/services/actividades";

export type { CrmDashboardData } from "@/features/crm/services/dashboard";

export function useCrmDashboardData() {
  const { user } = useAuth();
  return useQuery<CrmDashboardData>({
    queryKey: queryKeys.crm.dashboard(user?.id),
    queryFn: () => fetchCrmDashboard(user?.id, user?.email),
    staleTime: 60_000,
  });
}

/** Conteo de actividades vencidas (no completadas, fecha_programada < ahora) del usuario. */
export function useActividadesVencidasCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.crm.actividades.vencidasCount(user?.id),
    enabled: !!user?.id,
    queryFn: () => countActividadesVencidas(user!.id, user!.email),
    staleTime: 60_000,
  });
}

/** Lista de actividades vencidas (top 5) para banner del dashboard. */
export function useActividadesVencidasList(limit = 5) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.crm.actividades.vencidasList(user?.id, limit),
    enabled: !!user?.id,
    queryFn: () => listActividadesVencidas(user!.id, limit, user!.email),
    staleTime: 60_000,
  });
}
