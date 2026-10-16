import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, dehydrate, hydrate } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { useExchangeRates } from "../useExchangeRates";
import { queryClient } from "@/lib/query/queryClient";
import { fetchExchangeRates } from "@/features/catalogos/services";

vi.mock("@/features/catalogos/services", () => ({
  fetchExchangeRates: vi.fn(),
}));

const rates = { usdMxn: 20, eurMxn: 22, esFallback: false };
const refreshedRates = { ...rates, usdMxn: 21 };
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

function restoreRates(age: number, fecha?: string) {
  const source = new QueryClient();
  source.setQueryData(fecha ? ["exchange-rates", fecha] : ["exchange-rates"], rates, {
    updatedAt: Date.now() - age,
  });
  hydrate(queryClient, dehydrate(source));
  source.clear();
}

beforeEach(() => {
  queryClient.clear();
  vi.mocked(fetchExchangeRates).mockReset().mockResolvedValue(refreshedRates);
});
afterEach(() => queryClient.clear());

describe("useExchangeRates", () => {
  it("fetches exchange rates", async () => {
    const { result } = renderHook(() => useExchangeRates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(refreshedRates);
    expect(fetchExchangeRates).toHaveBeenCalledWith(undefined);
  });

  it("reutiliza las tasas hidratadas frescas sin reconsultar", () => {
    restoreRates(60_000);
    const { result } = renderHook(() => useExchangeRates(), { wrapper });
    expect(result.current.data).toEqual(rates);
    expect(result.current.isStale).toBe(false);
    expect(fetchExchangeRates).not.toHaveBeenCalled();
  });

  it.each([undefined, "2026-10-15"])("reconsulta tasas hidratadas vencidas para fecha %s", async (fecha) => {
    restoreRates(60 * 60_000 + 1, fecha);
    const { result } = renderHook(() => useExchangeRates(fecha), { wrapper });
    expect(result.current.data).toEqual(rates);
    await waitFor(() => expect(result.current.data).toEqual(refreshedRates));
    expect(fetchExchangeRates).toHaveBeenCalledWith(fecha);
    expect(fetchExchangeRates).toHaveBeenCalledTimes(1);
  });
});
