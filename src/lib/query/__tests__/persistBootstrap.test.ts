// @vitest-environment node
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { storage, getStorageRef } = vi.hoisted(() => {
  const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
  return { storage, getStorageRef: vi.fn(() => storage) };
});
vi.mock("@/lib/browserStorage", () => ({
  getStorageRef,
  STORAGE_KEYS: { queryCache: "synthetic-query-cache" },
}));

type Persist = typeof import("@tanstack/react-query-persist-client").persistQueryClient;
const persistSpy = vi.fn<Persist>();
const clients: QueryClient[] = [];
const unsubscribers: (() => void)[] = [];

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  storage.getItem.mockReset().mockReturnValue(null);
  storage.setItem.mockReset();
  storage.removeItem.mockReset();
  getStorageRef.mockReset().mockReturnValue(storage);
  const actual = await vi.importActual<typeof import("@tanstack/react-query-persist-client")>(
    "@tanstack/react-query-persist-client",
  );
  persistSpy.mockReset().mockImplementation((options) => {
    const result = actual.persistQueryClient(options);
    unsubscribers.push(result[0]);
    return result;
  });
  vi.doMock("@tanstack/react-query-persist-client", () => ({ ...actual, persistQueryClient: persistSpy }));
});

afterEach(() => {
  unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function loadBootstrap() {
  const { bootstrapQueryPersister } = await import("../persistBootstrap");
  const contract = await import("../queryClient");
  clients.push(contract.queryClient);
  return { bootstrapQueryPersister, ...contract };
}

function snapshot(buster: string, timestamp = Date.now(), onlyRates = false) {
  const source = new QueryClient();
  clients.push(source);
  source.setQueryData(["exchange-rates"], { usdMxn: 20 });
  source.setQueryData(["tasa_iva"], 0.16);
  source.setQueryData(["embarques", "org-fixture"], { private: "operational fixture" });
  const clientState = dehydrate(source, onlyRates ? {
    shouldDehydrateQuery: (query) => query.queryKey[0] === "exchange-rates",
  } : undefined);
  return JSON.stringify({ buster, timestamp, clientState });
}

describe("bootstrapQueryPersister: contrato con persister real y storage sintético", () => {
  it("inicializa una vez y guarda sólo tasas públicas, sin mutaciones pausadas", async () => {
    const { bootstrapQueryPersister, queryClient, PERSISTED_CATALOG_MAX_AGE, PERSISTED_CATALOG_BUSTER } = await loadBootstrap();
    await Promise.all([bootstrapQueryPersister(queryClient), bootstrapQueryPersister(queryClient)]);
    await bootstrapQueryPersister(queryClient);
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).toHaveBeenCalledWith(expect.objectContaining({
      queryClient, maxAge: PERSISTED_CATALOG_MAX_AGE, buster: PERSISTED_CATALOG_BUSTER,
    }));

    queryClient.setQueryData(["exchange-rates"], { usdMxn: 20 });
    queryClient.setQueryData(["exchange-rates", "dof-fecha", "2026-10-15"], { usdMxn: 19 });
    queryClient.setQueryData(["tasa_iva"], 0.16);
    queryClient.setQueryData(["embarques"], { private: "operational fixture" });
    queryClient.getMutationCache().build(queryClient, { mutationKey: ["save-invoice"] }, {
      context: undefined, data: undefined, error: null, failureCount: 0, failureReason: null,
      isPaused: true, status: "pending", variables: { private: "mutation fixture" }, submittedAt: Date.now(),
    });
    await vi.advanceTimersByTimeAsync(1000);
    const saved = JSON.parse(storage.setItem.mock.lastCall![1]);
    expect(saved.clientState.queries.map((query: { queryKey: unknown }) => query.queryKey)).toEqual([
      ["exchange-rates"], ["exchange-rates", "dof-fecha", "2026-10-15"],
    ]);
    expect(saved.clientState.mutations).toEqual([]);
  });

  it("descarta el snapshot anterior aunque sea reciente, sin hidratar IVA ni operaciones", async () => {
    storage.getItem.mockReturnValue(snapshot(""));
    const { bootstrapQueryPersister, queryClient } = await loadBootstrap();
    await bootstrapQueryPersister(queryClient);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(storage.removeItem).toHaveBeenCalledWith("synthetic-query-cache");
  });

  it("descarta un snapshot del contrato actual si supera 24 h", async () => {
    const { bootstrapQueryPersister, queryClient, PERSISTED_CATALOG_MAX_AGE, PERSISTED_CATALOG_BUSTER } = await loadBootstrap();
    storage.getItem.mockReturnValue(snapshot(PERSISTED_CATALOG_BUSTER, Date.now() - PERSISTED_CATALOG_MAX_AGE - 1));
    await bootstrapQueryPersister(queryClient);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(storage.removeItem).toHaveBeenCalledWith("synthetic-query-cache");
  });

  it("restaura un snapshot vigente y conserva las tasas inactivas después de 5 min", async () => {
    const { bootstrapQueryPersister, queryClient, PERSISTED_CATALOG_BUSTER } = await loadBootstrap();
    storage.getItem.mockReturnValue(snapshot(PERSISTED_CATALOG_BUSTER, Date.now(), true));
    await bootstrapQueryPersister(queryClient);
    expect(queryClient.getQueryData(["exchange-rates"])).toEqual({ usdMxn: 20 });
    expect(storage.removeItem).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1);
    expect(queryClient.getQueryData(["exchange-rates"])).toEqual({ usdMxn: 20 });
  });

  it("conserva consultas normales si falla el chunk de persistencia", async () => {
    vi.doMock("@tanstack/react-query-persist-client", () => { throw new Error("synthetic chunk unavailable"); });
    const { bootstrapQueryPersister, queryClient } = await loadBootstrap();
    await expect(bootstrapQueryPersister(queryClient)).resolves.toBeUndefined();
    await expect(queryClient.fetchQuery({ queryKey: ["exchange-rates"], queryFn: async () => 20 })).resolves.toBe(20);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it("absorbe el rechazo de restore incluso si leer y borrar storage fallan", async () => {
    storage.getItem.mockImplementation(() => { throw new Error("synthetic read failure"); });
    storage.removeItem.mockImplementation(() => { throw new Error("synthetic remove failure"); });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { bootstrapQueryPersister, queryClient } = await loadBootstrap();
    await expect(bootstrapQueryPersister(queryClient)).resolves.toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalled();
    await expect(queryClient.fetchQuery({ queryKey: ["exchange-rates"], queryFn: async () => 20 })).resolves.toBe(20);
  });

  it("sigue sirviendo tasas si storage rechaza la escritura", async () => {
    storage.setItem.mockImplementation(() => { throw new Error("synthetic quota failure"); });
    const { bootstrapQueryPersister, queryClient } = await loadBootstrap();
    await bootstrapQueryPersister(queryClient);
    queryClient.setQueryData(["exchange-rates"], { usdMxn: 20 });
    await expect(vi.advanceTimersByTimeAsync(1000)).resolves.toBeDefined();
    expect(storage.setItem).toHaveBeenCalled();
    expect(queryClient.getQueryData(["exchange-rates"])).toEqual({ usdMxn: 20 });
  });
});
