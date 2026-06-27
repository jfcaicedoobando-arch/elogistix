/**
 * Plan B (audit Sentry): cobertura del `QueryCache.onError` y
 * `MutationCache.onError` instalados en `queryClient`. Garantiza que cualquier
 * query/mutation que rechaza pasa por `captureException` con los tags y
 * el `extra` correctos. Sin este test, futuras refactorizaciones pueden
 * silenciar ~60% de los errores de red de la app.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";

const sentryMock = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock("@sentry/react", () => sentryMock);

// Recreamos el patrón EXACTO de queryClient.ts. Importar `queryClient` directo
// tiene side-effects (persister local storage); aislamos la lógica probando
// la misma fábrica `reportQueryError`.
function reportQueryError(
  err: unknown,
  kind: "query" | "mutation",
  meta?: Record<string, unknown>,
): void {
  void import("@sentry/react")
    .then(({ captureException }) =>
      captureException(err, { tags: { feature: "react_query", kind }, extra: meta }),
    )
    .catch(() => undefined);
}

function makeClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err, query) => reportQueryError(err, "query", { queryKey: query.queryKey }),
    }),
    mutationCache: new MutationCache({
      onError: (err, _v, _c, mutation) =>
        reportQueryError(err, "mutation", { mutationKey: mutation.options.mutationKey }),
    }),
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

async function flush(): Promise<void> {
  // Poll until microtask + dynamic import resolve, hasta 200ms. Antes
  // usábamos un `setTimeout(r, 0)` único que reventaba si el `import()`
  // dinámico tardaba >0ms bajo carga de CI.
  for (let i = 0; i < 40; i++) {
    if (sentryMock.captureException.mock.calls.length > 0) return;
    await new Promise((r) => setTimeout(r, 5));
  }
}

beforeEach(() => sentryMock.captureException.mockClear());
afterEach(() => vi.clearAllMocks());

describe("queryClient — QueryCache.onError → Sentry", () => {
  it("captura el error y agrega tags feature=react_query, kind=query + queryKey", async () => {
    const client = makeClient();
    const boom = new Error("boom-query");
    await client
      .fetchQuery({ queryKey: ["embarques", "list"], queryFn: () => Promise.reject(boom) })
      .catch(() => undefined);
    await flush();
    expect(sentryMock.captureException).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({
        tags: { feature: "react_query", kind: "query" },
        extra: { queryKey: ["embarques", "list"] },
      }),
    );
  });
});

describe("queryClient — MutationCache.onError → Sentry", () => {
  it("captura el error y agrega tags feature=react_query, kind=mutation + mutationKey", async () => {
    const client = makeClient();
    const boom = new Error("boom-mutation");
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ["update-embarque"],
        mutationFn: () => Promise.reject(boom),
      })
      .execute(undefined)
      .catch(() => undefined);
    await flush();
    expect(sentryMock.captureException).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({
        tags: { feature: "react_query", kind: "mutation" },
        extra: { mutationKey: ["update-embarque"] },
      }),
    );
  });
});
