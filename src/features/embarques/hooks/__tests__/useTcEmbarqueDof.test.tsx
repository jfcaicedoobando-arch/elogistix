import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import { useAlinearTcEmbarqueDof } from "../useTcEmbarqueDof";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), registrar: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: mocks.registrar }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: mocks.success, notifyError: mocks.error }));

const respuesta = { fecha_dof: "2026-10-13", usd_anterior: 20, usd_nuevo: 19, eur_anterior: 22, eur_nuevo: 21 };
let client: QueryClient;
function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 2, retryDelay: 0 } } });
  mocks.registrar.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); client.clear(); });

describe("useAlinearTcEmbarqueDof", () => {
  it("muestra el USD devuelto y refresca el contexto, P&L y detalles", async () => {
    mocks.rpc.mockResolvedValue({ data: respuesta, error: null });
    const invalidar = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAlinearTcEmbarqueDof("emb-1"), { wrapper });
    await act(async () => { await result.current.mutateAsync("2026-10-13"); });
    expect(mocks.success).toHaveBeenCalledWith(undefined, expect.objectContaining({ description: expect.stringContaining("19.0000") }));
    expect(mocks.success.mock.calls[0]?.[1].description).not.toContain("NaN");
    for (const queryKey of [queryKeys.embarques.tcContexto("emb-1"), queryKeys.embarques.pnlFinanciero("emb-1"), queryKeys.embarques.single("emb-1"), queryKeys.embarques.full("emb-1")]) {
      expect(invalidar).toHaveBeenCalledWith({ queryKey });
    }
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("no repite una RPC exitosa con respuesta perdida aunque el cliente configure retries", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const invalidar = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAlinearTcEmbarqueDof("emb-1"), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync("2026-10-13")).rejects.toThrow(/Actualiza el embarque/); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.registrar).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: queryKeys.embarques.tcContexto("emb-1") });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: queryKeys.embarques.pnlFinanciero("emb-1") });
  });

  it("un rechazo no se reintenta automáticamente; permite el siguiente intento explícito", async () => {
    const error = new Error("Servicio no disponible");
    mocks.rpc.mockResolvedValueOnce({ data: null, error }).mockResolvedValueOnce({ data: respuesta, error: null });
    const { result } = renderHook(() => useAlinearTcEmbarqueDof("emb-1"), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync("2026-10-13")).rejects.toBe(error); });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.success).not.toHaveBeenCalled();
    await act(async () => { await expect(result.current.mutateAsync("2026-10-13")).resolves.toEqual(respuesta); });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.registrar).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });
});
