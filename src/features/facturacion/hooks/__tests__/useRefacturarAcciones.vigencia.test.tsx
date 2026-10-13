import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ navigate: vi.fn(), cancelar: vi.fn() }));
vi.mock("react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/features/facturacion/hooks/useTimbrarFactura", () => ({ useCancelarFactura: () => ({ mutate: mocks.cancelar }) }));
vi.mock("@/features/facturacion/hooks/useTimbrarRep", () => ({ useCancelarRep: () => ({ mutate: vi.fn() }) }));
vi.mock("@/features/facturacion/hooks/useConsultarRep", () => ({ useConsultarRep: () => ({ mutate: vi.fn() }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));
import { useRefacturarAcciones } from "../useRefacturarAcciones";
type Params = Parameters<typeof useRefacturarAcciones>[0];
function params(): Params {
  return { facturaId: "original", puedeOperar: true, rutaFiscal: "01", motivo: "m", clienteDestinoId: "c", pagoSeleccionadoId: "p", yaReasignado: false, bloqueo: null, ordenanteNombre: "Cliente", ordenanteRfc: "RFC", onClose: vi.fn(),
    s: { paso: 5, caso: { id: "caso", factura_nueva_id: "nueva" }, estadoFacturaNueva: "vigente", capturarOperacion: () => ({ isCurrent: () => true, assertCurrent: () => {} }), verificarNueva: vi.fn().mockResolvedValue({ id: "nueva" }), refrescar: vi.fn(), abrir: { mutate: vi.fn() }, avanzar: { mutate: vi.fn() }, cerrar: { mutate: vi.fn() }, reasignar: { mutate: vi.fn() } } as unknown as Params["s"] };
}
beforeEach(() => vi.clearAllMocks());
describe("acciones abiertas se invalidan por estado de la nueva", () => {
  it("polling viva a baja cierra la oferta de navegar y cancelar original", async () => {
    const p = params();
    const { result, rerender } = renderHook(({ p }) => useRefacturarAcciones(p), { initialProps: { p } });
    rerender({ p: { ...p, s: { ...p.s, estadoFacturaNueva: "eliminada" }, bloqueo: "Nueva dada de baja" } });
    await act(async () => { await result.current.handleIrABorrador("nueva"); await result.current.handleCancelarOriginal(); result.current.handleContinuar(); });
    expect(mocks.navigate).not.toHaveBeenCalled(); expect(mocks.cancelar).not.toHaveBeenCalled(); expect(p.s.reasignar.mutate).not.toHaveBeenCalled();
  });
  it("fallo de verificación al actuar no navega ni cancela", async () => {
    const p = params(); vi.mocked(p.s.verificarNueva).mockRejectedValue(new Error("baja"));
    const { result } = renderHook(() => useRefacturarAcciones(p));
    await act(async () => { await result.current.handleIrABorrador("nueva"); await result.current.handleCancelarOriginal(); });
    expect(mocks.navigate).not.toHaveBeenCalled(); expect(mocks.cancelar).not.toHaveBeenCalled(); expect(p.onClose).not.toHaveBeenCalled();
  });
  it("doble clic de continuar inicia una sola reasignación antes del rerender", () => {
    const p = params(); const { result } = renderHook(() => useRefacturarAcciones(p));
    act(() => { result.current.handleContinuar(); result.current.handleContinuar(); });
    expect(p.s.reasignar.mutate).toHaveBeenCalledTimes(1);
  });
  it("doble clic de cancelar original verifica una vez", async () => {
    const p = params(); const { result } = renderHook(() => useRefacturarAcciones(p));
    await act(async () => { await Promise.all([result.current.handleCancelarOriginal(), result.current.handleCancelarOriginal()]); });
    expect(p.s.verificarNueva).toHaveBeenCalledTimes(1); expect(mocks.cancelar).toHaveBeenCalledTimes(1);
  });
});
