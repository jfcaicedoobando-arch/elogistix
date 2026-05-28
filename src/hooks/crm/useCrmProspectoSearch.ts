/**
 * Hook React Query para `buscarProspectos`. La I/O vive en
 * `services/crm/prospectoSearch.ts`.
 */
import { useQuery } from "@tanstack/react-query";
import {
  buscarProspectos,
  type ProspectoMatch,
} from "@/services/crm/prospectoSearch";

export type { ProspectoMatch };

export function useCrmProspectoSearch(term: string) {
  const t = term.trim();
  return useQuery<ProspectoMatch[]>({
    queryKey: ["crm", "prospecto-search", t],
    enabled: t.length >= 2,
    staleTime: 30_000,
    queryFn: () => buscarProspectos(t),
  });
}
