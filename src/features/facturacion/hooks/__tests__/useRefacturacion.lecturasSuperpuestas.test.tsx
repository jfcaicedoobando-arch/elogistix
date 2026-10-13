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
import { useRefacturarAcciones } from "../useRefacturarAcciones";
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
describe("independent: overlapping reader results revoke old preflights", () => {
  it.each(["deleted", "error", "absent", "unknown"])("%s observed while case refetch is pending must stop a live preflight", async mode => {
    const { result } = setup();
    await waitFor(() => expect(result.current.estadoFacturaNueva).toBe("vigente"));
    const preflight = deferred<typeof nueva>();
    api.factura.mockImplementationOnce(() => preflight.promise);
    const previousCalls = api.factura.mock.calls.length;
    let mutation!: Promise<unknown>;
    act(() => { mutation = result.current.cerrar.mutateAsync(false).catch(e => e); });
    await waitFor(() => expect(api.factura).toHaveBeenCalledTimes(previousCalls + 1));
    const refreshingCase = deferred<typeof caso>();
    api.caso.mockReturnValue(refreshingCase.promise);
    act(() => { void qc.refetchQueries({ queryKey: queryKeys.facturacion.refacturacionCaso("original"), exact: true }); });
    await waitFor(() => expect(result.current.estadoFacturaNueva).toBe("verificando"));
    if (mode === "deleted") api.factura.mockResolvedValue({ ...nueva, deleted_at: "2026-10-13" });
    else if (mode === "absent") api.factura.mockResolvedValue(null);
    else if (mode === "unknown") api.factura.mockResolvedValue({ ...nueva, deleted_at: undefined });
    else api.factura.mockRejectedValue(new Error("Reader now denies access"));
    await act(async () => { await qc.refetchQueries({ queryKey: queryKeys.facturacion.refacturacionFactura("nueva"), exact: true }); });
    const state = qc.getQueryState(queryKeys.facturacion.refacturacionFactura("nueva"));
    if (mode === "deleted") expect(state?.data).toEqual({ ...nueva, deleted_at: "2026-10-13" });
    else if (mode === "absent") expect(state?.data).toBeNull();
    else if (mode === "unknown") expect(state?.data).toEqual({ ...nueva, deleted_at: undefined });
    else expect(state?.status).toBe("error");
    await act(async () => { preflight.resolve(nueva); await mutation; });
    expect(api.cerrar).not.toHaveBeenCalled();
  });
  it("a sent step RPC resolved after close/reopen cannot set the reopened step", async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.estadoFacturaNueva).toBe("vigente"));
    const sent = deferred<void>(); api.avanzar.mockReturnValue(sent.promise);
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.avanzar.mutateAsync(4); });
    await waitFor(() => expect(api.avanzar).toHaveBeenCalledOnce());
    rerender({ id: "original", open: false }); rerender({ id: "original", open: true });
    await act(async () => { sent.resolve(); await pending; });
    expect(result.current.paso).toBe(3);
  });
});

describe("independent: completion concurrent with polling", () => {
  it("can finish after reassignment succeeds during a live-invoice refetch", async () => {
    api.caso.mockResolvedValue({ ...caso, paso_actual: 5 });
    const reassigned = deferred<string>(); api.reasignar.mockReturnValue(reassigned.promise);
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => {
      const s = useRefacturacion("original", true);
      const a = useRefacturarAcciones({ s, facturaId: "original", puedeOperar: true, rutaFiscal: "01", motivo: "m", clienteDestinoId: "c", pagoSeleccionadoId: "p", yaReasignado: Boolean(s.caso?.pago_nuevo_id), bloqueo: null, ordenanteNombre: "Cliente", ordenanteRfc: "RFC", onClose: vi.fn() });
      return { s, a };
    }, { wrapper });
    await waitFor(() => expect(result.current.s.estadoFacturaNueva).toBe("vigente"));
    act(() => result.current.a.handleContinuar());
    await waitFor(() => expect(api.reasignar).toHaveBeenCalledOnce());
    const polling = deferred<typeof nueva>(); api.factura.mockReturnValue(polling.promise);
    act(() => { void qc.refetchQueries({ queryKey: queryKeys.facturacion.refacturacionFactura("nueva"), exact: true }); });
    await waitFor(() => expect(result.current.s.estadoFacturaNueva).toBe("verificando"));
    api.caso.mockResolvedValue({ ...caso, paso_actual: 5, pago_nuevo_id: "pn" });
    await act(async () => { reassigned.resolve("pn"); });
    await waitFor(() => expect(api.success).toHaveBeenCalled());
    await act(async () => { polling.resolve(nueva); });
    await waitFor(() => expect(result.current.s.estadoFacturaNueva).toBe("vigente"));
    expect(result.current.s.caso?.pago_nuevo_id).toBe("pn");
    act(() => result.current.a.handleContinuar());
    await waitFor(() => expect(api.cerrar).toHaveBeenCalledExactlyOnceWith("caso", false));
    expect(api.reasignar).toHaveBeenCalledOnce();
  });
});
