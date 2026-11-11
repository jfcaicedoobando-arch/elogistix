import { useQuery } from "@tanstack/react-query";
import { fetchAuditoriaPendientesCount, fetchReporteAuditoria } from "@/features/auditoria/services";
import { auditoria } from "@/features/auditoria/queryKeys";
import { useOrgFilter } from "@/hooks/shared";

export const AUDITORIA_QUERY_KEY = auditoria.embarques;

export function useAuditoria({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: AUDITORIA_QUERY_KEY,
    queryFn: fetchReporteAuditoria,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled,
  });
}

/** El prefijo de revisiones invalida el conteo al marcar, asignar o silenciar. */
export function useAuditoriaCount({ enabled = true }: { enabled?: boolean } = {}) {
  const { organizationId, orgListo } = useOrgFilter();
  return useQuery({
    queryKey: auditoria.pendientesCount(organizationId),
    queryFn: fetchAuditoriaPendientesCount,
    staleTime: 60_000,
    enabled: enabled && orgListo && !!organizationId,
  });
}
