import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";

const svc = vi.hoisted(() => ({ recalculate: vi.fn(), remove: vi.fn(), update: vi.fn(), advance: vi.fn(), error: vi.fn() }));
vi.mock("../../services/demorasEmbarque", () => ({
  calcularDemorasEmbarque: svc.recalculate, eliminarDemorasAuto: svc.remove, contarDemorasAuto: vi.fn(),
}));
vi.mock("@/features/embarques/services/contenedores", () => ({ actualizarDemorasContenedor: svc.update }));
vi.mock("@/features/embarques/services", () => ({ avanzarEstadoEmbarqueRpc: svc.advance, reabrirEmbarqueRpc: vi.fn() }));
vi.mock("@/features/embarques/hooks", () => ({ useContenedoresEmbarque: () => ({ data: [], isLoading: false }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyInfo: vi.fn(), notifySuccess: vi.fn(), notifyWarning: vi.fn(), notifyError: svc.error }));
import { useRecalcularDemoras, useEliminarDemorasAuto } from "../useDemorasEmbarque";
import { useTabDemorasController } from "../useTabDemorasController";
import { useAvanzarEstadoEmbarque } from "../mutations/useEstadoEmbarqueBasico";

let client: QueryClient;
const own = queryKeys.embarques.pnlFinanciero("A");
const other = queryKeys.embarques.pnlFinanciero("B");
const nested = [...own, "unrelated-extension"];
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const invalidated = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } } });
  for (const key of [own, other, nested]) client.setQueryData(key, { estado_costos: "completo" });
  svc.recalculate.mockReset().mockResolvedValue({ dias_excedidos: 2 });
  svc.remove.mockReset().mockResolvedValue(undefined);
  svc.update.mockReset().mockResolvedValue(undefined);
  svc.advance.mockReset().mockResolvedValue(undefined);
  svc.error.mockClear();
});
afterEach(() => client.clear());

for (const flow of [
  { label: "recalcular", hook: useRecalcularDemoras, service: svc.recalculate },
  { label: "eliminar auto", hook: useEliminarDemorasAuto, service: svc.remove },
]) {
  describe(`${flow.label}: documentación129`, () => {
    it("invalida sólo P&L exacto del embarque modificado y conserva las otras invalidaciones", async () => {
      const previousKeys = [queryKeys.embarques.full("A"), queryKeys.embarques.conceptosCosto("A"), queryKeys.embarques.conceptosVenta("A")];
      for (const key of previousKeys) client.setQueryData(key, {});
      const { result } = renderHook(() => flow.hook("A"), { wrapper });
      await act(async () => { await result.current.mutateAsync(); });
      expect(flow.service).toHaveBeenCalledWith("A");
      expect(invalidated(own)).toBe(true);
      expect(invalidated(other)).toBe(false);
      expect(invalidated(nested)).toBe(false);
      for (const key of previousKeys) expect(invalidated(key)).toBe(true);
    });

    it("reconsulta P&L activo antes de resolver aunque su caché siga fresca30s", async () => {
      const fetchPnl = vi.fn().mockResolvedValue({ estado_costos: "incompleto", utilidad_mxn: null });
      const observer = new QueryObserver(client, { queryKey: own, queryFn: fetchPnl, staleTime: 30_000 });
      const unsubscribe = observer.subscribe(() => {});
      expect(fetchPnl).not.toHaveBeenCalled();
      const { result } = renderHook(() => flow.hook("A"), { wrapper });
      try {
        await act(async () => { await result.current.mutateAsync(); });
        expect(fetchPnl).toHaveBeenCalledTimes(1);
        expect(client.getQueryData(own)).toEqual({ estado_costos: "incompleto", utilidad_mxn: null });
        expect(client.getQueryData(other)).toEqual({ estado_costos: "completo" });
      } finally { unsubscribe(); }
    });

    it("conserva el embarque afectado si cambia la navegación mientras espera", async () => {
      let finish!: (value: { dias_excedidos: number }) => void;
      flow.service.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      const { result, rerender } = renderHook(({ id }) => flow.hook(id), { wrapper, initialProps: { id: "A" } });
      let pending!: Promise<unknown>;
      act(() => { pending = result.current.mutateAsync(); });
      await waitFor(() => expect(flow.service).toHaveBeenCalledWith("A"));
      rerender({ id: "B" });
      await act(async () => { finish({ dias_excedidos: 2 }); await pending; });
      expect(invalidated(own)).toBe(true);
      expect(invalidated(other)).toBe(false);
    });

    it("un rechazo conserva el error y refresca por si hubo cambios parciales", async () => {
      flow.service.mockRejectedValue(new Error("rejected"));
      const { result } = renderHook(() => flow.hook("A"), { wrapper });
      await act(async () => { await expect(result.current.mutateAsync()).rejects.toThrow("rejected"); });
      expect(invalidated(own)).toBe(true);
      expect(invalidated(other)).toBe(false);
      expect(svc.error).toHaveBeenCalled();
    });
  });
}

describe("editar fechas o días del contenedor", () => {
  it("invalida P&L después del guardado que puede recalcular conceptos", async () => {
    const { result } = renderHook(() => useTabDemorasController("A"), { wrapper });
    act(() => result.current.setDraft("container", { fecha_descarga: "2026-10-01", dias_libres_override: 2 }));
    act(() => result.current.guardar("container"));
    await waitFor(() => expect(invalidated(own)).toBe(true));
    expect(svc.update).toHaveBeenCalledWith("container", { fecha_descarga: "2026-10-01", dias_libres_override: 2 });
    expect(invalidated(other)).toBe(false);
    expect(invalidated(nested)).toBe(false);
    await waitFor(() => expect(result.current.drafts).toEqual({}));
  });

  it("mantiene el id original aunque navegue antes de responder", async () => {
    let finish!: () => void;
    svc.update.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ id }) => useTabDemorasController(id), { wrapper, initialProps: { id: "A" } });
    act(() => result.current.setDraft("container", { fecha_devolucion: "2026-10-08" }));
    act(() => result.current.guardar("container"));
    await waitFor(() => expect(svc.update).toHaveBeenCalledTimes(1));
    rerender({ id: "B" });
    act(() => finish());
    await waitFor(() => expect(invalidated(own)).toBe(true));
    expect(invalidated(other)).toBe(false);
  });

  it("sin draft no guarda; con error conserva draft y refresca el resultado observado", async () => {
    svc.update.mockRejectedValue(new Error("rejected"));
    const { result } = renderHook(() => useTabDemorasController("A"), { wrapper });
    act(() => result.current.guardar("container"));
    expect(svc.update).not.toHaveBeenCalled();
    act(() => result.current.setDraft("container", { dias_libres_override: 2 }));
    act(() => result.current.guardar("container"));
    await waitFor(() => expect(svc.update).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(invalidated(own)).toBe(true);
    expect(svc.error).toHaveBeenCalled();
    expect(result.current.drafts.container).toEqual({ dias_libres_override: 2 });
  });
});

describe("avance manual a Entregado", () => {
  it("preserva RPC e idempotencia y actualiza P&L exacto del embarque entregado", async () => {
    const { result } = renderHook(() => useAvanzarEstadoEmbarque(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ embarqueId: "A", nuevoEstado: "Entregado", usuarioEmail: "fixture@test.local", requestId: "request129" }); });
    expect(svc.advance).toHaveBeenCalledWith(expect.objectContaining({ embarqueId: "A", nuevoEstado: "Entregado", requestId: "request129" }));
    expect(invalidated(own)).toBe(true);
    expect(invalidated(other)).toBe(false);
    expect(invalidated(nested)).toBe(false);
  });

  it("otro estado conserva el comportamiento previo sin nueva invalidación P&L", async () => {
    const { result } = renderHook(() => useAvanzarEstadoEmbarque(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ embarqueId: "A", nuevoEstado: "Confirmado", usuarioEmail: "fixture@test.local" }); });
    expect(invalidated(own)).toBe(false);
  });

  it("rechazar el avance conserva el error y reconsulta por posible fallo de transporte", async () => {
    svc.advance.mockRejectedValue(new Error("rejected"));
    const { result } = renderHook(() => useAvanzarEstadoEmbarque(), { wrapper });
    await act(async () => { await expect(result.current.mutateAsync({ embarqueId: "A", nuevoEstado: "Entregado", usuarioEmail: "fixture@test.local" })).rejects.toThrow("rejected"); });
    expect(invalidated(own)).toBe(true);
    expect(invalidated(other)).toBe(false);
  });
});
