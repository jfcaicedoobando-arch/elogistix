/**
 * Plan A (audit Sentry): valida que `fetchExchangeRates()` reporta a Sentry
 * cuando la edge function falla, con tags `feature: 'exchange_rates'`,
 * `source: 'edge_invoke'`, y re-lanza para que React Query active su retry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@sentry/react", () => ({ captureException: mocks.captureException }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import { fetchExchangeRates } from "../index";

beforeEach(() => {
  mocks.captureException.mockClear();
  mocks.invoke.mockReset();
});
afterEach(() => vi.clearAllMocks());

async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 5));
}

describe("fetchExchangeRates — captureException", () => {
  it("reporta y re-lanza cuando la edge function devuelve error", async () => {
    const edgeErr = new Error("edge-500");
    mocks.invoke.mockResolvedValue({ data: null, error: edgeErr });

    await expect(fetchExchangeRates()).rejects.toBe(edgeErr);
    await flush();

    expect(mocks.captureException).toHaveBeenCalledWith(
      edgeErr,
      expect.objectContaining({
        tags: { feature: "exchange_rates", source: "edge_invoke" },
      }),
    );
  });

  it("retorna tipos de cambio sin reportar en happy path", async () => {
    mocks.invoke.mockResolvedValue({ data: { usdMxn: 18, eurMxn: 19 }, error: null });
    const res = await fetchExchangeRates();
    await flush();
    expect(res).toEqual({ usdMxn: 18, eurMxn: 19 });
    expect(mocks.captureException).not.toHaveBeenCalled();
  });
});
