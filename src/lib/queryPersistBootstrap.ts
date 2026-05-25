/**
 * Bootstrap diferido del persister de React Query.
 *
 * Por qué: `@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister`
 * pesan ~25 KB y sólo aportan valor *después* del primer render (re-hidratar
 * catálogos estáticos desde localStorage). Cargarlos vía dynamic import en
 * `requestIdleCallback` los saca del chunk crítico y los aísla en
 * `query-persist-vendor` (ver `vite.config.ts`).
 *
 * Trade-off aceptado: durante los primeros ~200 ms tras el primer paint los
 * catálogos no están hidratados; las queries refetchearán normalmente al
 * montar. No hay regresión funcional.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryPersister, shouldDehydrateCatalogQuery } from "@/lib/queryClient";

let started = false;

export async function bootstrapQueryPersister(client: QueryClient): Promise<void> {
  if (started) return;
  started = true;
  try {
    const { persistQueryClient } = await import("@tanstack/react-query-persist-client");
    persistQueryClient({
      queryClient: client,
      persister: queryPersister,
      maxAge: 24 * 60 * 60 * 1000, // 24h
      dehydrateOptions: {
        shouldDehydrateQuery: (query) =>
          shouldDehydrateCatalogQuery(query.queryKey, query.state.status),
      },
    });
  } catch {
    // Persist es una optimización; si falla el chunk, la app sigue 100%
    // funcional sin caché entre sesiones.
  }
}
