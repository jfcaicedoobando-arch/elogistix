import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";

const mock = vi.hoisted(() => {
  const calls: string[] = [];
  const state = { failStages: false };
  let resolveEtapas: (result: { data: { id: string; nombre: string; tipo: string }[]; error: null }) => void;
  const etapas = new Promise((resolve) => { resolveEtapas = resolve; });
  const from = (table: string) => {
    const chain = {
      select: () => chain, is: () => chain, gte: () => chain, lte: () => chain, limit: () => chain,
      then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => {
        calls.push(table);
        return (table === "crm_etapas_pipeline" ? (state.failStages ? Promise.reject(new Error("stage unavailable")) : etapas) : Promise.resolve({ data: [], error: null })).then(resolve, reject);
      },
    };
    return chain;
  };
  return { state, calls, from, release: () => resolveEtapas({ data: [{ id: "1", nombre: "Abierta", tipo: "abierta" }], error: null }) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mock.from } }));
import { useForecast, useReportesCRM } from "../useForecastReportes";
describe("CRM analytics query work", () => {
  it("starts opportunity work before stages resolve and shares one stage read across both panels", async () => {
    const { result } = renderHook(() => ({ forecast: useForecast(), report: useReportesCRM() }), { wrapper: createWrapper() });
    await waitFor(() => expect(mock.calls.filter((t) => t === "crm_oportunidades")).toHaveLength(2));
    expect(result.current.forecast.isLoading).toBe(true);
    expect(mock.calls.filter((t) => t === "crm_etapas_pipeline")).toHaveLength(1);
    await act(async () => mock.release());
    await waitFor(() => expect(result.current.forecast.isSuccess && result.current.report.isSuccess).toBe(true));
    expect(mock.calls).toHaveLength(5);
  });
  it("does not multiply the outer panel retry budget on a failed catalog", async () => {
    mock.calls.length = 0;
    mock.state.failStages = true;
    const client = new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: 0 } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useForecast(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mock.calls.filter((t) => t === "crm_etapas_pipeline")).toHaveLength(3);
    expect(mock.calls.filter((t) => t === "crm_oportunidades")).toHaveLength(3);
    unmount();
    client.clear();
    mock.state.failStages = false;
  });
});
