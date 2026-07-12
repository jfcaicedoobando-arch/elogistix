/**
 * useCrmSearch — búsqueda rápida de entidades CRM (leads, oportunidades, actividades)
 * para el command palette Cmd+P. Debounced 200ms, limit 6 por tipo.
 */
import { useQuery } from "@tanstack/react-query";
import { searchCrm, type CrmSearchHit } from "@/features/crm/services/search";
import { queryKeys } from "@/lib/query";

export type { CrmSearchHit } from "@/features/crm/services/search";

export function useCrmSearch(term: string) {
  const t = term.trim();
  return useQuery<CrmSearchHit[]>({
    queryKey: queryKeys.crm.search(t),
    enabled: t.length >= 2,
    staleTime: 30_000,
    queryFn: () => searchCrm(t),
  });
}
