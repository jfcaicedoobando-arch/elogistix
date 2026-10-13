import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
const api = vi.hoisted(() => ({ caso: vi.fn(), factura: vi.fn(), avanzar: vi.fn(), cerrar: vi.fn(), reasignar: vi.fn(), success: vi.fn() }));
vi.mock("@/features/facturacion/services/refacturacion", () => ({ obtenerCasoRefacturacion: api.caso, obtenerEstadoFacturaRefacturacion: api.factura, avanzarPasoRefacturacion: api.avanzar, cerrarCasoRefacturacion: api.cerrar, reasignarPagoFactura: api.reasignar, duplicarFacturaParaRefacturacion: vi.fn(), abrirCasoRefacturacion: vi.fn() }));
vi.mock("@/features/facturacion/hooks/usePagosFactura", () => ({ usePagosFactura: () => ({ data: [], isLoading: false }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: api.success, notifyError: vi.fn() }));
vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/features/facturacion/hooks/useTimbrarFactura", () => ({ useCancelarFactura: () => ({ mutate: vi.fn() }) }));
vi.mock("@/features/facturacion/hooks/useTimbrarRep", () => ({ useCancelarRep: () => ({ mutate: vi.fn() }) }));
vi.mock("@/features/facturacion/hooks/useConsultarRep", () => ({ useConsultarRep: () => ({ mutate: vi.fn() }) }));
import { useRefacturacion } from "../useRefacturacion";
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const nueva = { id: "nueva", numero: "F2", estado: "Emitida", uuid_fiscal: "uuid", deleted_at: null as string | null };
const caso = { id: "caso", factura_original_id: "original", factura_nueva_id: "nueva", paso_actual: 3 };
let qc: QueryClient;
function setup() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(({ id, open }) => useRefacturacion(id, open), { wrapper, initialProps: { id: "original", open: true } });
}
beforeEach(() => {
  vi.resetAllMocks(); api.caso.mockResolvedValue(caso);
  api.factura.mockImplementation(async id => ({ ...nueva, id }));
});
afterEach(() => { cleanup(); qc?.clear(); });
describe("independent: known fiscal invalidation", () => {
  it.each(["Cancelada", "Sustituida"])("%s from polling stops a stale emitted preflight", async estado => {
    const { result } = setup();
    await waitFor(() => expect(result.current.estadoFacturaNueva).toBe("vigente"));
    const preflight = deferred<typeof nueva>();
    api.factura.mockImplementationOnce(() => preflight.promise);
    const previousCalls = api.factura.mock.calls.length;
    let mutation!: Promise<unknown>;
    act(() => { mutation = result.current.cerrar.mutateAsync(false).catch(e => e); });
    await waitFor(() => expect(api.factura).toHaveBeenCalledTimes(previousCalls + 1));
    api.factura.mockResolvedValue({ ...nueva, estado });
    await act(async () => { await qc.refetchQueries({ queryKey: queryKeys.facturacion.refacturacionFactura("nueva"), exact: true }); });
    await waitFor(() => expect(result.current.facturaNueva?.estado).toBe(estado));
    await act(async () => { preflight.resolve(nueva); await mutation; });
    expect(api.cerrar).not.toHaveBeenCalled();
  });
});
