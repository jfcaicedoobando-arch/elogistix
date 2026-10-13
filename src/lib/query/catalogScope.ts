import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { captureAuthDataScope } from "@/lib/auth/authOperationScope";

type CatalogScope = ReturnType<typeof captureAuthDataScope>;
const CATALOG_ROOTS = new Set(["planes", "puertos", "navieras", "tipos_contenedor", "tipos_cambio_dof"]);

/** Preserva los prefijos de invalidación; nunca comparte filas entre ámbitos. */
export function catalogScopeKey(key: QueryKey, scope: CatalogScope): QueryKey {
  return [...key, "session-scope", scope.userId, scope.organizationId, scope.role, scope.generation];
}

/** Retira ámbitos obsoletos y claves legadas abandonadas; conserva sus observadores. */
export function removeStaleCatalogQueries(client: QueryClient, generation: number): void {
  client.removeQueries({
    predicate: (query) => {
      if (!CATALOG_ROOTS.has(String(query.queryKey[0]))) return false;
      const queryGeneration = query.meta?.catalogSessionGeneration;
      // DOF también tiene consumidores ajenos al wrapper (incluso deshabilitados).
      // Retirar su Query los desacopla de la respuesta y de futuras invalidaciones.
      return typeof queryGeneration === "number"
        ? queryGeneration !== generation
        : query.getObserversCount() === 0;
    },
  });
}
