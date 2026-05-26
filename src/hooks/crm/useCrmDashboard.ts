/**
 * Hooks consolidados para el Dashboard del CRM.
 * I/O delegada a `services/crm/dashboard` y `services/crm/actividades`.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import { fetchCrmDashboard, type CrmDashboardData } from "@/services/crm/dashboard";
import {
  countActividadesVencidas,
  listActividadesVencidas,
} from "@/services/crm/actividades";

export type { CrmDashboardData } from "@/services/crm/dashboard";

export function useCrmDashboardData() {
  const { user } = useAuth();
  return useQuery<CrmDashboardData>({
    queryKey: queryKeys.crm.dashboard(user?.id),
    queryFn: () => fetchCrmDashboard(user?.id),
    staleTime: 60_000,
  });
}

/** Conteo de actividades vencidas (no completadas, fecha_programada < ahora) del usuario. */
export function useActividadesVencidasCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.crm.actividades.vencidasCount(user?.id),
    enabled: !!user?.id,
    queryFn: () => countActividadesVencidas(user!.id),
    staleTime: 60_000,
  });
}

/** Lista de actividades vencidas (top 5) para banner del dashboard. */
export function useActividadesVencidasList(limit = 5) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.crm.actividades.vencidasList(user?.id, limit),
    enabled: !!user?.id,
    queryFn: () => listActividadesVencidas(user!.id, limit),
    staleTime: 60_000,
  });
}
