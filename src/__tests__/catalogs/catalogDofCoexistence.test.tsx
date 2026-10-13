import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({ history: vi.fn(), byDate: vi.fn(), update: vi.fn() }));
vi.mock("@/features/catalogos/services/tipoCambioDof", () => ({
  fetchHistorialTcDof: io.history, fetchTcDofPorFecha: io.byDate,
}));
vi.mock("@/features/embarques/services", () => ({ actualizarTipoCambioUsdEmbarque: io.update }));
vi.mock("@/features/catalogos/hooks/useExchangeRates", () => ({
  useExchangeRates: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/lib/query", () => ({ queryKeys: {
  embarques: { all: ["embarques"], detail: (id: string) => ["embarques", id] },
} }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));
vi.mock("@/lib/diagnostics/errorDetailsStore", () => ({ clearErrorReports: vi.fn() }));

import { useTcInicial } from "@/features/catalogos/hooks/useTcInicial";
import { useProformaTcRecovery } from "@/features/embarques/hooks/useProformaTcRecovery";
import { tcDofKeys } from "@/features/catalogos/hooks/useTipoCambioDof";
import { useTcDofPorFecha, tcDofPorFechaKey } from "@/features/catalogos/hooks/useTcDofPorFecha";
// eslint-disable-next-line no-restricted-imports -- Regression intentionally exercises the private scope wrapper with real DOF consumers.
import { useCatalogQuery } from "@/hooks/shared/useCatalogQuery";
import { navieras } from "@/features/catalogos/queryKeys";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { getSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";
import { removeStaleCatalogQueries } from "@/lib/query/catalogScope";

const history = (usd: number) => [{ fecha: "2026-10-13", usd_mxn: usd, eur_mxn: 20,
  fuente: "mock", origen: "manual", updated_at: "2026-10-13" }];
let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function useConsumers() {
  return { initial: useTcInicial(), recovery: useProformaTcRecovery("mock-embarque") };
}
function useOtherCatalog() {
  return useCatalogQuery({ queryKey: navieras.all, queryFn: async () => [], staleTime: 60_000 });
}
const dofQuery = () => client.getQueryCache().find({ queryKey: tcDofKeys.historial(1), exact: true });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  io.history.mockReset();
  io.byDate.mockReset();
  io.update.mockReset().mockResolvedValue(undefined);
  setAuthSnapshot({ userId: "dof-user", email: null, organizationId: "org", organizationName: null,
    role: "operador", effectiveRole: "operador" });
});
afterEach(() => { cleanup(); client.clear(); });

describe("real DOF consumers coexist with scoped catalogs", () => {
  it("a pending DOF read still reaches both consumers when another catalog mounts", async () => {
    let resolve!: (rows: ReturnType<typeof history>) => void;
    io.history.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const consumers = renderHook(useConsumers, { wrapper: Wrapper });
    await act(async () => consumers.result.current.recovery.activar());
    await waitFor(() => expect(io.history).toHaveBeenCalledOnce());
    const original = dofQuery();
    expect(original?.getObserversCount()).toBe(2);
    const catalog = renderHook(useOtherCatalog, { wrapper: Wrapper });
    await waitFor(() => expect(catalog.result.current.isSuccess).toBe(true));
    await act(async () => resolve(history(18)));
    await waitFor(() => expect(consumers.result.current.initial.data?.usdMxn).toBe(18));
    expect(consumers.result.current.initial.isLoading).toBe(false);
    expect(consumers.result.current.initial.data?.fuente).toBe("DOF");
    expect(consumers.result.current.recovery.tcSugerido).toBe(18);
    expect(consumers.result.current.recovery.tcRequerido).toBe(true);
    expect(consumers.result.current.recovery.guardando).toBe(false);
    expect(dofQuery()).toBe(original);
  });

  it("loaded DOF observers remain attached and both update on invalidation", async () => {
    io.history.mockResolvedValue(history(18));
    const consumers = renderHook(useConsumers, { wrapper: Wrapper });
    await act(async () => consumers.result.current.recovery.activar());
    await waitFor(() => expect(consumers.result.current.initial.data?.usdMxn).toBe(18));
    const original = dofQuery();
    const catalog = renderHook(useOtherCatalog, { wrapper: Wrapper });
    await waitFor(() => expect(catalog.result.current.isSuccess).toBe(true));
    io.history.mockResolvedValue(history(19));
    await act(async () => { await client.invalidateQueries({ queryKey: tcDofKeys.all }); });
    await waitFor(() => expect(consumers.result.current.initial.data?.usdMxn).toBe(19));
    expect(consumers.result.current.recovery.tcSugerido).toBe(19);
    expect(dofQuery()).toBe(original);
    expect(io.history).toHaveBeenCalledTimes(2);
  });

  it("a disabled recovery observer is preserved and can activate normally", async () => {
    io.history.mockResolvedValue(history(18));
    const recovery = renderHook(() => useProformaTcRecovery("mock-embarque"), { wrapper: Wrapper });
    const original = dofQuery();
    expect(original?.getObserversCount()).toBe(1);
    expect(original?.isActive()).toBe(false);
    const catalog = renderHook(useOtherCatalog, { wrapper: Wrapper });
    await waitFor(() => expect(catalog.result.current.isSuccess).toBe(true));
    expect(dofQuery()).toBe(original);
    expect(io.history).not.toHaveBeenCalled();
    await act(async () => recovery.result.current.activar());
    await waitFor(() => expect(recovery.result.current.tcSugerido).toBe(18));
    expect(dofQuery()).toBe(original);
    await act(async () => { expect(await recovery.result.current.guardarTc(18)).toBe(true); });
    expect(io.update).toHaveBeenCalledWith("mock-embarque", 18);
    expect(recovery.result.current.tcRequerido).toBe(false);
    expect(recovery.result.current.guardando).toBe(false);
  });

  it("preserves observed legacy queries but removes abandoned ones and older managed scopes", async () => {
    io.history.mockResolvedValue(history(18));
    const consumers = renderHook(useConsumers, { wrapper: Wrapper });
    await waitFor(() => expect(consumers.result.current.initial.data?.usdMxn).toBe(18));
    const original = dofQuery();
    const generation = getSessionCacheGeneration();
    const managedKey = ["planes", "old-managed"];
    await client.fetchQuery({ queryKey: managedKey, queryFn: async () => ["old"],
      meta: { catalogSessionGeneration: generation - 1 } });
    client.setQueryData(["tipos_cambio_dof", "abandoned"], history(17));
    client.setQueryData(["unrelated-audit-domain"], "keep");
    removeStaleCatalogQueries(client, generation);
    expect(dofQuery()).toBe(original);
    expect(client.getQueryData(managedKey)).toBeUndefined();
    expect(client.getQueryData(["tipos_cambio_dof", "abandoned"])).toBeUndefined();
    expect(client.getQueryData(["unrelated-audit-domain"])).toBe("keep");
  });

  it("date-specific DOF reads keep their silent-error metadata and invalidation", async () => {
    const initial = { usdMxn: 18, eurMxn: 20, fecha: "2026-10-13", exacto: true };
    io.byDate.mockResolvedValue(initial);
    const rate = renderHook(() => useTcDofPorFecha("2026-10-13"), { wrapper: Wrapper });
    await waitFor(() => expect(rate.result.current.data).toEqual(initial));
    const original = client.getQueryCache().find({ queryKey: tcDofPorFechaKey("2026-10-13"), exact: true });
    expect(original?.meta).toEqual({ silentError: true });
    const catalog = renderHook(useOtherCatalog, { wrapper: Wrapper });
    await waitFor(() => expect(catalog.result.current.isSuccess).toBe(true));
    io.byDate.mockResolvedValue({ ...initial, usdMxn: 19 });
    await act(async () => { await client.invalidateQueries({ queryKey: tcDofKeys.all }); });
    await waitFor(() => expect(rate.result.current.data?.usdMxn).toBe(19));
    expect(client.getQueryCache().find({ queryKey: tcDofPorFechaKey("2026-10-13"), exact: true })).toBe(original);
    expect(original?.meta).toEqual({ silentError: true });
  });
});
