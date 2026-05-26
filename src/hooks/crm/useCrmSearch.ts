/**
 * useCrmSearch — búsqueda rápida de entidades CRM (leads, oportunidades, actividades)
 * para el command palette Cmd+P. Debounced 200ms, limit 6 por tipo.
 */
import { useQuery } from "@tanstack/react-query";
import { searchCrm, type CrmSearchHit } from "@/services/crm/search";

export type { CrmSearchHit } from "@/services/crm/search";

export function useCrmSearch(term: string) {
  const t = term.trim();
  return useQuery<CrmSearchHit[]>({
    queryKey: ["crm", "search", t],
    enabled: t.length >= 2,
    staleTime: 30_000,
    queryFn: () => searchCrm(t),
  });
}
