/**
 * Plan A (audit Sentry): valida que `fetchExchangeRates()` reporta a Sentry
 * cuando la edge function falla con un error no transitorio, y que para
 * `FunctionsFetchError` (fallo de red) devuelve el fallback sin reportar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@sentry/react", () => ({
  captureException: mocks.captureException,
  addBreadcrumb: mocks.addBreadcrumb,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import { fetchExchangeRates } from "../index";

beforeEach(() => {
  mocks.captureException.mockClear();
  mocks.addBreadcrumb.mockClear();
  mocks.invoke.mockReset();
});
afterEach(() => vi.clearAllMocks());

async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  for (let k = 0; k < 5; k++) await new Promise((r) => setTimeout(r, 0));
}

describe("fetchExchangeRates — captureException", () => {
  it("reporta y re-lanza cuando la edge function devuelve error genérico (5xx)", async () => {
    const edgeErr = Object.assign(new Error("edge-500"), { name: "Error" });
    mocks.invoke.mockResolvedValue({ data: null, error: edgeErr });

    await expect(fetchExchangeRates()).rejects.toBe(edgeErr);
    await flush();
    await vi.waitFor(() => expect(mocks.captureException).toHaveBeenCalled());

    expect(mocks.captureException).toHaveBeenCalledWith(
      edgeErr,
      expect.objectContaining({
        tags: expect.objectContaining({ feature: "exchange_rates", op: "edge_invoke" }),
      }),
    );
  });

  it("devuelve fallback sin reportar a Sentry cuando es FunctionsFetchError (red)", async () => {
    const fetchErr = Object.assign(new Error("Failed to send a request to the Edge Function"), {
      name: "FunctionsFetchError",
    });
    mocks.invoke.mockResolvedValue({ data: null, error: fetchErr });

    const res = await fetchExchangeRates();
    await flush();

    expect(res).toEqual({ usdMxn: 17.25, eurMxn: 18.5, esFallback: true });
    expect(mocks.captureException).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(mocks.addBreadcrumb).toHaveBeenCalled());
    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "exchange_rates",
        level: "warning",
      }),
    );
  });

  it("retorna tipos de cambio sin reportar en happy path", async () => {
    mocks.invoke.mockResolvedValue({ data: { usdMxn: 18, eurMxn: 19 }, error: null });
    const res = await fetchExchangeRates();
    await flush();
    expect(res).toEqual({ usdMxn: 18, eurMxn: 19, esFallback: false });
    expect(mocks.captureException).not.toHaveBeenCalled();
  });
});
