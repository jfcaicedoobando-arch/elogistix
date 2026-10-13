import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import type { EstadoFacturaNueva } from "../../domain/refacturacionNuevaVigencia";
const api = vi.hoisted(() => ({ caso: vi.fn(), factura: vi.fn(), avanzar: vi.fn(), reasignar: vi.fn(), cerrar: vi.fn(), duplicar: vi.fn(), refresh: vi.fn(), success: vi.fn(), cancelar: vi.fn(), navigate: vi.fn(), close: vi.fn() }));
const current = vi.hoisted(() => ({ generation: 1, casoId: "caso-a", estado: "vigente" as EstadoFacturaNueva, paso: 5, nuevaId: "nueva" as string | null }));
vi.mock("@/lib/auth/authOperationScope", () => ({ captureAuthDataScope: () => {
  const generation = current.generation;
  return { generation, isCurrent: () => generation === current.generation };
} }));
vi.mock("@/features/facturacion/hooks/useRefacturacionQueries", () => ({ useRefacturacionQueries: () => {
  const id = current.casoId;
  return { caso: { id, factura_nueva_id: current.nuevaId, paso_actual: current.paso }, estadoFacturaNueva: current.estado, leerContextoRefacturacion: () => ({ casoId: current.casoId, nuevaId: current.nuevaId, estado: current.estado, lista: true }), refrescar: () => api.refresh(id) };
} }));
vi.mock("@/features/facturacion/services/refacturacion", () => ({ obtenerCasoRefacturacion: api.caso, obtenerEstadoFacturaRefacturacion: api.factura, avanzarPasoRefacturacion: api.avanzar, reasignarPagoFactura: api.reasignar, cerrarCasoRefacturacion: api.cerrar, duplicarFacturaParaRefacturacion: api.duplicar, abrirCasoRefacturacion: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: api.success, notifyError: vi.fn() }));
vi.mock("react-router", () => ({ useNavigate: () => api.navigate }));
vi.mock("@/features/facturacion/hooks/useTimbrarFactura", () => ({ useCancelarFactura: () => ({ mutate: api.cancelar }) }));
vi.mock("@/features/facturacion/hooks/useTimbrarRep", () => ({ useCancelarRep: () => ({ mutate: vi.fn() }) }));
vi.mock("@/features/facturacion/hooks/useConsultarRep", () => ({ useConsultarRep: () => ({ mutate: vi.fn() }) }));
import { useRefacturacion } from "../useRefacturacion";
import { useRefacturarAcciones } from "../useRefacturarAcciones";
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const nueva = { id: "nueva", numero: "F2", estado: "Emitida", uuid_fiscal: "uuid", deleted_at: null };
let qc: QueryClient;
function setup() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(({ id, open }) => {
    const s = useRefacturacion(id, open);
    const a = useRefacturarAcciones({ s, facturaId: id, puedeOperar: true, rutaFiscal: "01", motivo: "m", clienteDestinoId: "c", pagoSeleccionadoId: "p", yaReasignado: false, bloqueo: null, ordenanteNombre: "Cliente", ordenanteRfc: "RFC", onClose: api.close });
    return { s, a };
  }, { wrapper, initialProps: { id: "original-a", open: true } });
}
beforeEach(() => {
  vi.resetAllMocks(); current.generation = 1; current.casoId = "caso-a"; current.estado = "vigente"; current.paso = 5; current.nuevaId = "nueva";
  api.caso.mockImplementation(async () => ({ id: current.casoId, factura_nueva_id: current.nuevaId }));
  api.factura.mockResolvedValue(nueva);
});
afterEach(() => { cleanup(); qc?.clear(); });
const cambios = ["cerrar-reabrir", "original-A-B-A", "caso-A-B-A", "organización-A-B-A", "baja", "error"] as const;
type Cambio = typeof cambios[number];
function cambiar(cambio: Cambio, rerender: ReturnType<typeof setup>["rerender"]) {
  if (cambio === "cerrar-reabrir") { rerender({ id: "original-a", open: false }); rerender({ id: "original-a", open: true }); }
  else if (cambio === "original-A-B-A") { rerender({ id: "original-b", open: true }); rerender({ id: "original-a", open: true }); }
  else if (cambio === "caso-A-B-A") { current.casoId = "caso-b"; rerender({ id: "original-a", open: true }); current.casoId = "caso-a"; rerender({ id: "original-a", open: true }); }
  else if (cambio === "organización-A-B-A") { current.generation += 2; rerender({ id: "original-a", open: true }); }
  else { current.estado = cambio === "baja" ? "eliminada" : "error"; rerender({ id: "original-a", open: true }); }
}
describe("continuaciones de refacturación conservan identidad y vigencia", () => {
  it.each(cambios)("%s durante lectura impide avanzar, reasignar y cerrar", async (cambio) => {
    const read = deferred<typeof nueva>(); api.factura.mockReturnValue(read.promise);
    const { result, rerender } = setup();
    let results!: Promise<PromiseSettledResult<unknown>[]>;
    act(() => { results = Promise.allSettled([
      result.current.s.avanzar.mutateAsync(4),
      result.current.s.reasignar.mutateAsync({ pagoId: "p", facturaDestinoId: "nueva", casoId: "caso-a" }),
      result.current.s.cerrar.mutateAsync(false),
    ]); });
    await waitFor(() => expect(api.factura).toHaveBeenCalledTimes(3));
    cambiar(cambio, rerender);
    await act(async () => { read.resolve(nueva); await results; });
    expect(api.avanzar).not.toHaveBeenCalled(); expect(api.reasignar).not.toHaveBeenCalled(); expect(api.cerrar).not.toHaveBeenCalled();
    expect(api.success).not.toHaveBeenCalled();
  });
  it.each(cambios.flatMap(cambio => (["navegar", "cancelar"] as const).map(accion => ({ cambio, accion }))))("$cambio durante lectura impide $accion", async ({ cambio, accion }) => {
    const read = deferred<typeof nueva>(); api.factura.mockReturnValue(read.promise);
    const { result, rerender } = setup();
    let actions!: Promise<unknown>;
    act(() => { actions = accion === "navegar" ? result.current.a.handleIrABorrador("nueva") : result.current.a.handleCancelarOriginal(); });
    await waitFor(() => expect(api.factura).toHaveBeenCalledOnce());
    cambiar(cambio, rerender);
    await act(async () => { read.resolve(nueva); await actions; });
    expect(api.navigate).not.toHaveBeenCalled(); expect(api.cancelar).not.toHaveBeenCalled(); expect(api.close).not.toHaveBeenCalled();
  });
  it("una lectura de caso tardía no inicia ni la siguiente lectura al cerrar", async () => {
    const read = deferred<{ id: string; factura_nueva_id: string }>(); api.caso.mockReturnValue(read.promise);
    const { result, rerender } = setup();
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.s.cerrar.mutateAsync(false).catch(() => undefined); });
    await waitFor(() => expect(api.caso).toHaveBeenCalledOnce());
    rerender({ id: "original-a", open: false });
    await act(async () => { read.resolve({ id: "caso-a", factura_nueva_id: "nueva" }); await pending; });
    expect(api.factura).not.toHaveBeenCalled(); expect(api.cerrar).not.toHaveBeenCalled();
  });
  it("callback capturado en A no envía nada después de A-B-A", async () => {
    const { result, rerender } = setup(); const captured = result.current.s.avanzar.mutateAsync;
    cambiar("caso-A-B-A", rerender);
    await act(async () => { await expect(captured(4)).rejects.toThrow(/contexto/); });
    expect(api.caso).not.toHaveBeenCalled(); expect(api.avanzar).not.toHaveBeenCalled();
  });
  it("reasignación ya enviada termina e invalida A sin cerrar B", async () => {
    const write = deferred<string>(); api.reasignar.mockReturnValue(write.promise);
    const { result, rerender } = setup();
    act(() => result.current.a.handleContinuar());
    await waitFor(() => expect(api.reasignar).toHaveBeenCalledOnce());
    current.casoId = "caso-b"; current.paso = 2; rerender({ id: "original-b", open: true });
    await act(async () => { write.resolve("p-nuevo"); });
    await waitFor(() => expect(api.refresh).toHaveBeenCalledWith("caso-a"));
    expect(api.refresh).not.toHaveBeenCalledWith("caso-b");
    expect(api.cerrar).not.toHaveBeenCalled(); expect(api.close).not.toHaveBeenCalled();
    expect(result.current.s.paso).toBe(2);
  });
  it("doble clic de continuar vivo ejecuta una reasignación y un cierre", async () => {
    api.reasignar.mockResolvedValue("p-nuevo");
    const { result } = setup();
    act(() => { result.current.a.handleContinuar(); result.current.a.handleContinuar(); });
    await waitFor(() => expect(api.cerrar).toHaveBeenCalledTimes(1));
    expect(api.reasignar).toHaveBeenCalledTimes(1); expect(api.close).toHaveBeenCalledOnce();
  });
  it("doble clic de abrir factura navega una vez", async () => {
    const read = deferred<typeof nueva>(); api.factura.mockReturnValue(read.promise);
    const { result } = setup();
    let actions!: Promise<unknown>;
    act(() => { actions = Promise.all([result.current.a.handleIrABorrador("nueva"), result.current.a.handleIrABorrador("nueva")]); });
    await waitFor(() => expect(api.factura).toHaveBeenCalledOnce());
    await act(async () => { read.resolve(nueva); await actions; });
    expect(api.navigate).toHaveBeenCalledOnce(); expect(api.close).toHaveBeenCalledOnce();
  });
  it("cierre durante preflight de creación no envía la duplicación", async () => {
    current.nuevaId = null; current.estado = "sin_referencia";
    const read = deferred<{ id: string; factura_nueva_id: null }>(); api.caso.mockReturnValue(read.promise);
    const { result, rerender } = setup();
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.s.duplicar.mutateAsync().catch(() => undefined); });
    await waitFor(() => expect(api.caso).toHaveBeenCalledOnce());
    rerender({ id: "original-a", open: false });
    await act(async () => { read.resolve({ id: "caso-a", factura_nueva_id: null }); await pending; });
    expect(api.duplicar).not.toHaveBeenCalled();
  });
});
