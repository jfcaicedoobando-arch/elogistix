/**
 * Tests P2 (v13.295.0) — hooks de plantillas de cotización.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useCotizacionPlantillas,
  useGuardarPlantilla,
  useAplicarPlantilla,
  useActualizarPlantilla,
  useEliminarPlantilla,
} from "@/features/cotizacion/hooks/useCotizacionPlantillas";
import { supabase } from "@/integrations/supabase/client";

interface MockState {
  selectData: unknown[];
  selectError: unknown;
  insertData: unknown;
  insertError: unknown;
  rpcData: unknown;
  rpcError: unknown;
}

const state: MockState = {
  selectData: [],
  selectError: null,
  insertData: null,
  insertError: null,
  rpcData: null,
  rpcError: null,
};

vi.mock("@/integrations/supabase/client", () => {
  const from = vi.fn(() => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.is = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() => Promise.resolve({ data: state.selectData, error: state.selectError }));
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.single = vi.fn(() => Promise.resolve({ data: state.insertData, error: state.insertError }));
    // Thenable para awaits sobre update().eq() sin .single()
    chain.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: state.insertData, error: state.insertError }).then(resolve);
    return chain;
  });
  const rpc = vi.fn(() => Promise.resolve({ data: state.rpcData, error: state.rpcError }));
  return { supabase: { from, rpc } };
});



function wrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useCotizacionPlantillas hooks (P2)", () => {
  beforeEach(() => {
    state.selectData = [];
    state.selectError = null;
    state.insertData = null;
    state.insertError = null;
    state.rpcData = null;
    state.rpcError = null;
    vi.clearAllMocks();
  });

  it("no consulta cuando no hay organizationId (query deshabilitada)", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useCotizacionPlantillas(null), { wrapper: wrapper(qc) });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("devuelve la lista de plantillas de la organización", async () => {
    state.selectData = [
      { id: "p1", nombre: "Shanghái → MZLO", veces_usada: 5 },
      { id: "p2", nombre: "Nueva plantilla", veces_usada: 0 },
    ];
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCotizacionPlantillas("org-1"), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(supabase.from).toHaveBeenCalledWith("cotizacion_plantillas");
  });

  it("propaga error de Supabase", async () => {
    state.selectError = { message: "boom" };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCotizacionPlantillas("org-1"), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("guarda plantilla e invalida cache de la org", async () => {
    state.insertData = { id: "new-p", nombre: "test" };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useGuardarPlantilla(), { wrapper: wrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: "org-1",
        usuarioId: "u1",
        nombre: "Test",
        visibilidad: "yo",
        values: {},
      });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["cotizacion_plantillas", "org-1"] });
  });

  it("aplica plantilla vía RPC y devuelve payload", async () => {
    state.rpcData = { version: 1, values: { ruta: "MX" } };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAplicarPlantilla(), { wrapper: wrapper(qc) });
    let payload: unknown;
    await act(async () => {
      payload = await result.current.mutateAsync("plantilla-1");
    });
    expect(supabase.rpc).toHaveBeenCalledWith("aplicar_plantilla_cotizacion", { _plantilla_id: "plantilla-1" });
    expect(payload).toEqual({ version: 1, values: { ruta: "MX" } });
  });

  it("propaga errores del RPC aplicar_plantilla", async () => {
    state.rpcError = { message: "Sin acceso a esta plantilla" };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAplicarPlantilla(), { wrapper: wrapper(qc) });
    await expect(
      act(async () => { await result.current.mutateAsync("plantilla-1"); })
    ).rejects.toThrow(/Sin acceso/);
  });


  it("useActualizarPlantilla envía patch y invalida la lista de la org", async () => {
    state.insertData = null;
    state.insertError = null;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useActualizarPlantilla(), { wrapper: wrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        id: "p1",
        organizationId: "org-1",
        nombre: "  Nuevo nombre  ",
        descripcion: "",
        visibilidad: "org",
      });
    });

    expect(supabase.from).toHaveBeenCalledWith("cotizacion_plantillas");
    expect(spy).toHaveBeenCalledWith({ queryKey: ["cotizacion_plantillas", "org-1"] });
  });

  it("useActualizarPlantilla no llama a Supabase si no hay campos que actualizar", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useActualizarPlantilla(), { wrapper: wrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ id: "p1", organizationId: "org-1" });
    });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("useActualizarPlantilla propaga error de Supabase", async () => {
    state.insertError = { message: "denegado" };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useActualizarPlantilla(), { wrapper: wrapper(qc) });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ id: "p1", organizationId: "org-1", nombre: "x" });
      }),
    ).rejects.toThrow(/denegado/);
  });

  it("useEliminarPlantilla marca deleted_at e invalida la lista", async () => {
    state.insertError = null;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useEliminarPlantilla(), { wrapper: wrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ id: "p1", organizationId: "org-1" });
    });

    expect(supabase.from).toHaveBeenCalledWith("cotizacion_plantillas");
    expect(spy).toHaveBeenCalledWith({ queryKey: ["cotizacion_plantillas", "org-1"] });
  });

  it("useEliminarPlantilla propaga error de Supabase", async () => {
    state.insertError = { message: "no permitido" };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useEliminarPlantilla(), { wrapper: wrapper(qc) });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ id: "p1", organizationId: "org-1" });
      }),
    ).rejects.toThrow(/no permitido/);
  });
});

