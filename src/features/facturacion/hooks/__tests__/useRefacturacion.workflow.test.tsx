import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
const api = vi.hoisted(() => ({ caso: vi.fn(), factura: vi.fn(), reasignar: vi.fn(), cerrar: vi.fn(), close: vi.fn() }));
vi.mock("@/features/facturacion/services/refacturacion", () => ({ obtenerCasoRefacturacion: api.caso, obtenerEstadoFacturaRefacturacion: api.factura, reasignarPagoFactura: api.reasignar, cerrarCasoRefacturacion: api.cerrar, duplicarFacturaParaRefacturacion: vi.fn(), abrirCasoRefacturacion: vi.fn(), avanzarPasoRefacturacion: vi.fn() }));
vi.mock("@/features/facturacion/hooks/usePagosFactura", () => ({ usePagosFactura: () => ({ data: [], isLoading: false }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/features/facturacion/hooks/useTimbrarFactura", () => ({ useCancelarFactura: () => ({ mutate: vi.fn() }) }));
vi.mock("@/features/facturacion/hooks/useTimbrarRep", () => ({ useCancelarRep: () => ({ mutate: vi.fn() }) }));
vi.mock("@/features/facturacion/hooks/useConsultarRep", () => ({ useConsultarRep: () => ({ mutate: vi.fn() }) }));
import { useRefacturacion } from "../useRefacturacion";
import { useRefacturarAcciones } from "../useRefacturarAcciones";
let qc: QueryClient;
afterEach(() => { cleanup(); qc?.clear(); vi.resetAllMocks(); });
describe("flujo con QueryClient real y refetch tras mutar", () => {
  it("refresco de cortesía no pierde el cierre encadenado tras reasignar una nueva viva", async () => {
    const caso = { id: "caso", factura_nueva_id: "nueva", paso_actual: 5 };
    api.caso.mockResolvedValue(caso);
    api.factura.mockImplementation(async id => ({ id, estado: id === "nueva" ? "Emitida" : "Cancelada", deleted_at: null, uuid_fiscal: "uuid", numero: "F1" }));
    api.reasignar.mockImplementation(async () => { api.caso.mockResolvedValue({ ...caso, pago_nuevo_id: "pn" }); return "pn"; });
    api.cerrar.mockResolvedValue(undefined);
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => {
      const s = useRefacturacion("original", true);
      return { s, a: useRefacturarAcciones({ s, facturaId: "original", puedeOperar: true, rutaFiscal: "01", motivo: "m", clienteDestinoId: "c", pagoSeleccionadoId: "p", yaReasignado: false, bloqueo: null, ordenanteNombre: "Cliente", ordenanteRfc: "RFC", onClose: api.close }) };
    }, { wrapper });
    await waitFor(() => expect(result.current.s.estadoFacturaNueva).toBe("vigente"));
    act(() => { result.current.a.handleContinuar(); result.current.a.handleContinuar(); });
    await waitFor(() => expect(api.close).toHaveBeenCalledOnce());
    expect(api.reasignar).toHaveBeenCalledOnce(); expect(api.cerrar).toHaveBeenCalledExactlyOnceWith("caso", false);
  });
});
