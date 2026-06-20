import { useCallback } from "react";
import { buscarGlobal } from "@/features/search/services";
import type { GlobalSearchResult } from "@/types/search";

export type { GlobalSearchResult } from "@/types/search";

/**
 * Hook para búsqueda global. Delega el I/O al search service.
 */
export function useGlobalSearch() {
  return useCallback(async (termino: string, limite = 5): Promise<GlobalSearchResult[]> => {
    const rows = await buscarGlobal(termino, limite);
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      sublabel: r.sublabel,
      type: r.tipo as GlobalSearchResult["type"],
      url: r.url,
    }));
  }, []);
}
