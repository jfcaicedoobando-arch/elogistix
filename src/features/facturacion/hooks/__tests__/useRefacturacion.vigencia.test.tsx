import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
const api = vi.hoisted(() => ({ caso: vi.fn(), estado: vi.fn(), duplicar: vi.fn(), avanzar: vi.fn(), reasignar: vi.fn(), cerrar: vi.fn(), success: vi.fn(), refrescar: vi.fn() }));
const cached = vi.hoisted(() => ({ caso: { id: "caso", factura_original_id: "original", factura_nueva_id: "nueva" as string | null, paso_actual: 5 }, estadoFacturaNueva: "vigente" }));
vi.mock("@/features/facturacion/hooks/useRefacturacionQueries", () => ({ useRefacturacionQueries: () => ({ ...cached, leerContextoRefacturacion: () => ({ casoId: cached.caso.id, nuevaId: cached.caso.factura_nueva_id, estado: cached.estadoFacturaNueva, lista: true }), refrescar: api.refrescar }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: api.success }));
vi.mock("@/features/facturacion/services/refacturacion", () => ({ obtenerCasoRefacturacion: api.caso, obtenerEstadoFacturaRefacturacion: api.estado, duplicarFacturaParaRefacturacion: api.duplicar, avanzarPasoRefacturacion: api.avanzar, reasignarPagoFactura: api.reasignar, cerrarCasoRefacturacion: api.cerrar, abrirCasoRefacturacion: vi.fn() }));
import { useRefacturacion } from "../useRefacturacion";
const nueva = { id: "nueva", numero: "F2", estado: "Emitida", uuid_fiscal: "uuid", deleted_at: null };
let qc: QueryClient;
function setup() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(() => useRefacturacion("original", true), { wrapper });
}
beforeEach(() => {
  vi.resetAllMocks(); cached.caso.factura_nueva_id = "nueva"; cached.estadoFacturaNueva = "vigente";
  api.caso.mockImplementation(async () => ({ ...cached.caso }));
  api.estado.mockResolvedValue(nueva);
  api.duplicar.mockResolvedValue("nueva");
});
afterEach(() => { cleanup(); qc?.clear(); });
describe("mutaciones refacturación revalidan destino sin recuperación automática", () => {
  it.each(["baja", "ausente", "error", "desconocida"])("%s bloquea avanzar, reasignar y cerrar aunque la caché sea viva", async (estado) => {
    if (estado === "error") api.estado.mockRejectedValue(new Error("offline"));
    else api.estado.mockResolvedValue(estado === "ausente" ? null : { ...nueva, deleted_at: estado === "baja" ? "2026-10-13" : undefined });
    const { result } = setup();
    await act(async () => {
      await expect(result.current.avanzar.mutateAsync(4)).rejects.toThrow();
      await expect(result.current.reasignar.mutateAsync({ pagoId: "p", facturaDestinoId: "nueva", casoId: "caso" })).rejects.toThrow();
      await expect(result.current.cerrar.mutateAsync(false)).rejects.toThrow();
    });
    expect(api.avanzar).not.toHaveBeenCalled(); expect(api.reasignar).not.toHaveBeenCalled(); expect(api.cerrar).not.toHaveBeenCalled();
    expect(api.success).not.toHaveBeenCalled();
  });
  it("conserva cancelación explícita del caso sin exigir recuperar la nueva", async () => {
    api.estado.mockResolvedValue({ ...nueva, deleted_at: "baja" });
    const { result } = setup();
    await act(async () => { await result.current.cerrar.mutateAsync(true); });
    expect(api.cerrar).toHaveBeenCalledWith("caso", true);
    expect(api.estado).not.toHaveBeenCalled();
  });
  it("no llama duplicación si un caso supuestamente sin nueva ya tiene referencia", async () => {
    cached.caso.factura_nueva_id = null; cached.estadoFacturaNueva = "sin_referencia";
    api.caso.mockResolvedValue({ ...cached.caso, factura_nueva_id: "existente" });
    const { result } = setup();
    await act(async () => { await expect(result.current.duplicar.mutateAsync()).rejects.toThrow(); });
    expect(api.duplicar).not.toHaveBeenCalled();
  });
  it("dos clics simultáneos comparten una duplicación y exactamente un ID vivo", async () => {
    cached.caso.factura_nueva_id = null; cached.estadoFacturaNueva = "sin_referencia";
    let resolver!: (value: string) => void;
    api.duplicar.mockImplementation(() => new Promise<string>(resolve => { resolver = resolve; }));
    const { result } = setup();
    let p1!: Promise<string>, p2!: Promise<string>;
    await act(async () => { p1 = result.current.duplicar.mutateAsync(); p2 = result.current.duplicar.mutateAsync(); });
    expect(api.duplicar).toHaveBeenCalledTimes(1);
    api.caso.mockResolvedValue({ ...cached.caso, factura_nueva_id: "nueva" });
    await act(async () => { resolver("nueva"); await expect(Promise.all([p1, p2])).resolves.toEqual(["nueva", "nueva"]); });
    expect(api.duplicar).toHaveBeenCalledTimes(1);
  });
  it("RPC que retorna borrador eliminado no se anuncia como éxito", async () => {
    cached.caso.factura_nueva_id = null; cached.estadoFacturaNueva = "sin_referencia";
    api.duplicar.mockImplementation(async () => { api.caso.mockResolvedValue({ ...cached.caso, factura_nueva_id: "nueva" }); return "nueva"; });
    api.estado.mockResolvedValue({ ...nueva, estado: "Borrador", uuid_fiscal: null, deleted_at: "baja" });
    const { result } = setup();
    await act(async () => { await expect(result.current.duplicar.mutateAsync()).rejects.toThrow(/baja/); });
    expect(api.success).not.toHaveBeenCalled(); expect(api.duplicar).toHaveBeenCalledTimes(1);
  });
  it("caso ilegible nunca dispara creación", async () => {
    cached.caso.factura_nueva_id = null; cached.estadoFacturaNueva = "sin_referencia";
    api.caso.mockRejectedValue(new Error("RLS/offline"));
    const { result } = setup();
    await act(async () => { await expect(result.current.duplicar.mutateAsync()).rejects.toThrow(); });
    expect(api.duplicar).not.toHaveBeenCalled();
  });
  it("destino fresco vivo mantiene avance, reasignación y cierre", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.avanzar.mutateAsync(4);
      await result.current.reasignar.mutateAsync({ pagoId: "p", facturaDestinoId: "nueva", casoId: "caso" });
      await result.current.cerrar.mutateAsync(false);
    });
    expect(api.avanzar).toHaveBeenCalledOnce(); expect(api.reasignar).toHaveBeenCalledOnce(); expect(api.cerrar).toHaveBeenCalledWith("caso", false);
  });
});
