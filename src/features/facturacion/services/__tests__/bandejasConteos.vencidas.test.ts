import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
import { fetchBandejaConteos } from "../bandejasConteos";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockImplementation(() => {
    const result = Promise.resolve({ count: 4, error: null });
    const chain = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), is: vi.fn(), gte: vi.fn(), or: vi.fn(), then: result.then.bind(result) };
    for (const key of ["select", "eq", "in", "is", "gte", "or"] as const) chain[key].mockReturnValue(chain);
    return chain;
  });
});

describe("Audit141: overdue count uses the full net-balance portfolio", () => {
  it("reads the tenant aggregate rather than a documentary-state count", async () => {
    mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === "cobranza_conteo_por_cobrar" ? 2 : 10, error: null }));
    expect(await fetchBandejaConteos("org-A")).toEqual({ porTimbrar: 4, porCobrar: 2, vencidas: 10, repPendientes: 4 });
    expect(mocks.rpc).toHaveBeenCalledWith("cobranza_conteo_vencidas", { p_organization_id: "org-A" });
    expect(mocks.rpc).toHaveBeenCalledWith("cobranza_conteo_por_cobrar", { p_organization_id: "org-A" });
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });
  it("preserves a legitimate zero count", async () => {
    mocks.rpc.mockResolvedValue({ data: 0, error: null });
    expect((await fetchBandejaConteos("org-A")).vencidas).toBe(0);
  });
  it("re-reads the aggregate when the consumer refreshes", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 4, error: null }).mockResolvedValueOnce({ data: 10, error: null })
      .mockResolvedValueOnce({ data: 3, error: null }).mockResolvedValueOnce({ data: 9, error: null });
    expect((await fetchBandejaConteos("org-A")).vencidas).toBe(10);
    expect((await fetchBandejaConteos("org-A")).vencidas).toBe(9);
  });
  it("propagates a failed aggregate instead of displaying a false zero", async () => {
    const error = new Error("aggregate unavailable");
    mocks.rpc.mockResolvedValue({ data: null, error });
    await expect(fetchBandejaConteos("org-A")).rejects.toBe(error);
  });
  it.each([null, -1, 1.5, "10"])("rejects an invalid aggregate %j", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(fetchBandejaConteos("org-A")).rejects.toThrow();
  });
});
