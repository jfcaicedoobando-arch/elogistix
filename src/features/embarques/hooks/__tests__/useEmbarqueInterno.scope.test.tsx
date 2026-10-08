import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const state = vi.hoisted(() => ({ userId: "user-a", role: "operador", org: "org-a", internalRead: vi.fn(), tariffRead: vi.fn(), reconciliationRead: vi.fn() }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: state.userId }, effectiveRole: state.role, loading: false }) }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: state.org, loading: false }) }));
vi.mock("@/features/embarques/services/internoEmbarque", () => ({ obtenerEmbarqueInterno: state.internalRead }));
vi.mock("@/features/embarques/services/tarifaInfo", () => ({ obtenerEmbarqueTarifaInfo: state.tariffRead }));
vi.mock("@/features/embarques/services/reconciliacion3Columnas", () => ({ obtenerReconciliacion3Columnas: state.reconciliationRead }));
import { useEmbarqueInterno } from "../useEmbarqueInterno";
import { useEmbarqueTarifaInfo } from "../useEmbarqueTarifaInfo";
import { useReconciliacion3Columnas } from "../useReconciliacion3Columnas";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { purgeSessionCache } from "@/lib/auth/purgeSessionCache";

function sync() {
  setAuthSnapshot({ userId: state.userId, email: null, organizationId: state.org, organizationName: null, role: state.role, effectiveRole: state.role });
}
let client: QueryClient;
beforeEach(() => {
  state.userId = "user-a"; state.role = "operador"; state.org = "org-a"; sync();
  state.internalRead.mockReset().mockResolvedValue({ tarifa_delta_jsonb: { mock_cost: 99 } });
  state.tariffRead.mockReset().mockResolvedValue({ tarifa_delta_jsonb: { mock_cost: 99 } });
  state.reconciliationRead.mockReset().mockResolvedValue({ filas: [{ mock_cost: 99 }] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
function useAllConsumers() { return { internal: useEmbarqueInterno("shipment"), tariff: useEmbarqueTarifaInfo("shipment"), reconciliation: useReconciliacion3Columnas("shipment") }; }

describe("private shipment consumer cache isolation", () => {
  it("same-user downgrade removes resolved private values without waiting for staleTime", async () => {
    const { result, rerender } = renderHook(useAllConsumers, { wrapper });
    await waitFor(() => expect(result.current.internal.data).toBeDefined());
    await waitFor(() => expect(result.current.tariff.data).toBeDefined());
    state.tariffRead.mockImplementation(() => new Promise(() => {}));
    act(() => { state.role = "cliente"; sync(); rerender(); });
    expect(result.current.internal.data).toBeUndefined();
    expect(result.current.tariff.data).toBeUndefined();
    expect(result.current.reconciliation.data).toBeUndefined();
    expect(state.internalRead).toHaveBeenCalledOnce();
    expect(state.reconciliationRead).toHaveBeenCalledOnce();
  });
  it.each(["user", "org"])("resolved data is not reused on %s switch", async (change) => {
    const { result, rerender } = renderHook(useAllConsumers, { wrapper });
    await waitFor(() => expect(result.current.internal.data).toBeDefined());
    state.internalRead.mockImplementation(() => new Promise(() => {}));
    state.tariffRead.mockImplementation(() => new Promise(() => {}));
    state.reconciliationRead.mockImplementation(() => new Promise(() => {}));
    act(() => { if (change === "user") state.userId = "user-b"; else state.org = "org-b"; sync(); rerender(); });
    expect(result.current.internal.data).toBeUndefined();
    expect(result.current.tariff.data).toBeUndefined();
    expect(result.current.reconciliation.data).toBeUndefined();
    expect(state.internalRead).toHaveBeenCalledTimes(2);
  });
  it("same-user fresh session uses another query key even if old query remains", async () => {
    const { result } = renderHook(useAllConsumers, { wrapper });
    await waitFor(() => expect(result.current.internal.data).toBeDefined());
    state.internalRead.mockImplementation(() => new Promise(() => {}));
    await act(async () => { purgeSessionCache(new QueryClient()); });
    expect(result.current.internal.data).toBeUndefined();
    expect(state.internalRead).toHaveBeenCalledTimes(2);
  });
});
