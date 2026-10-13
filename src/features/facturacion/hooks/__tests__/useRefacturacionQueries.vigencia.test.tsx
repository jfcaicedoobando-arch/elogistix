import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
const api = vi.hoisted(() => ({ caso: vi.fn(), factura: vi.fn() }));
vi.mock("@/features/facturacion/services/refacturacion", () => ({ obtenerCasoRefacturacion: api.caso, obtenerEstadoFacturaRefacturacion: api.factura }));
vi.mock("@/features/facturacion/hooks/usePagosFactura", () => ({ usePagosFactura: () => ({ data: [], isLoading: false }) }));
import { useRefacturacionQueries } from "../useRefacturacionQueries";
const nueva = { id: "nueva", numero: "F2", estado: "Emitida", uuid_fiscal: "uuid", deleted_at: null };
const caso = { id: "caso", factura_original_id: "original", factura_nueva_id: "nueva" };
let qc: QueryClient;
function setup() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(() => useRefacturacionQueries("original", true), { wrapper });
}
beforeEach(() => { api.caso.mockReset().mockResolvedValue(caso); api.factura.mockReset().mockImplementation(async (id) => id === "original" ? { ...nueva, id, estado: "Cancelada" } : nueva); });
afterEach(() => { cleanup(); qc?.clear(); vi.useRealTimers(); });
describe("lectura y polling de nueva en refacturación", () => {
  it("sólo ausencia explícita de ID permite crear; null/error con ID no", async () => {
    api.factura.mockResolvedValue(null);
    const { result } = setup();
    await waitFor(() => expect(result.current.estadoFacturaNueva).toBe("ausente"));
    expect(result.current.caso?.factura_nueva_id).toBe("nueva");
    api.caso.mockResolvedValue({ ...caso, factura_nueva_id: null });
    act(() => result.current.refrescar());
    await waitFor(() => expect(result.current.estadoFacturaNueva).toBe("sin_referencia"));
  });
  it("un error de nueva invalida caché viva sin borrar evidencia", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.estadoFacturaNueva).toBe("vigente"));
    api.factura.mockRejectedValue(new Error("offline"));
    act(() => result.current.refrescar());
    await waitFor(() => expect(result.current.estadoFacturaNueva).toBe("error"));
    expect(result.current.facturaNueva).toEqual(nueva);
  });
  it("un caso en caché sin ID no autoriza crear si falla su recarga", async () => {
    api.caso.mockResolvedValue({ ...caso, factura_nueva_id: null });
    const { result } = setup();
    await waitFor(() => expect(result.current.estadoFacturaNueva).toBe("sin_referencia"));
    api.caso.mockRejectedValue(new Error("offline"));
    act(() => result.current.refrescar());
    await waitFor(() => expect(result.current.estadoFacturaNueva).toBe("error"));
  });
  it("polling de 15 s cambia viva a eliminada y conserva el folio", async () => {
    vi.useFakeTimers();
    const { result } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(result.current.estadoFacturaNueva).toBe("vigente");
    const calls = api.factura.mock.calls.length;
    api.factura.mockResolvedValue({ ...nueva, deleted_at: "2026-10-13" });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_010); });
    expect(api.factura.mock.calls.length).toBeGreaterThan(calls);
    expect(result.current.estadoFacturaNueva).toBe("eliminada");
    expect(result.current.facturaNueva?.numero).toBe("F2");
  });
});
