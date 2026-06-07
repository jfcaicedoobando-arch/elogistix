import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Crea un wrapper con un QueryClient nuevo y lo registra en
 * `globalThis.__TEST_QUERY_CLIENT__` para que el `afterEach` global
 * (`src/test/setup.ts`) pueda hacer `cancelQueries → clear → unmount`
 * y evitar el leak transversal de suscripciones / providers montados
 * entre tests (causa del crecimiento de memoria en shards grandes).
 *
 * La asignación a globalThis es segura porque `vitest.config.ts`
 * fuerza `fileParallelism=false` + `maxForks=1`.
 */
export function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  (globalThis as unknown as {
    __TEST_QUERY_CLIENT__?: QueryClient;
  }).__TEST_QUERY_CLIENT__ = client;

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
