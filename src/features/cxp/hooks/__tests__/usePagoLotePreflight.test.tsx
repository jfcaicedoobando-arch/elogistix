import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { usePagoLotePreflight } from "../usePagoLotePreflight";
import { usePagoLoteState } from "../usePagoLoteState";
const { consultar, registrar } = vi.hoisted(() => ({ consultar: vi.fn(), registrar: vi.fn() }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: "org-prueba" }) }));
vi.mock("../../services/pagoProveedorLotePreflight", async (original) => ({
  ...await original<typeof import("../../services/pagoProveedorLotePreflight")>(), consultarEstadoFacturasLote: consultar,
}));
vi.mock("@/features/tesoreria/hooks", () => ({ useCuentasBancarias: () => ({ data: [] }) }));
vi.mock("@/features/catalogos/hooks/useTcDofPorFecha", () => ({ useTcDofPorFecha: () => ({ data: null }) }));
vi.mock("@/features/cxp/hooks/usePagoProveedorLote", () => ({ usePagoProveedorLote: () => ({ mutateAsync: registrar, isPending: false }) }));

const facturas = ["f1", "f2"].map((id) => ({ factura_id: id, folio_proveedor: id, fecha_vencimiento: null, saldo: 100 }));
const estado = (id: string, estado_aprobacion: string) => ({ id, estado_aprobacion, proveedor_id: "p1", moneda: "MXN" });
beforeEach(() => { consultar.mockReset(); registrar.mockReset(); });
function montar() {
  return renderHook(() => {
    const preflight = usePagoLotePreflight(true, facturas, "p1", "MXN");
    const state = usePagoLoteState({
      open: true, facturas: preflight.facturas, preflightPendiente: preflight.pendiente,
      preflightError: preflight.error, proveedorId: "p1", proveedorOrigen: "Nacional", moneda: "MXN",
      onOpenChange: vi.fn(), onDone: vi.fn(),
    });
    return { preflight, state };
  }, { wrapper: createWrapper() });
}
describe("Preflight visible del lote", () => {
  it("espera la lectura, omite pendientes del reparto y bloquea registro", async () => {
    consultar.mockResolvedValue([estado("f1", "pendiente"), estado("f2", "aprobada")]);
    const { result } = montar();
    expect(result.current.state.error).toMatch(/Verificando/);
    await waitFor(() => expect(result.current.preflight.pendiente).toBe(false));
    expect(result.current.state.error).toMatch(/aprobadas/);
    expect(result.current.state.saldoTotal).toBe(100);
    act(() => result.current.state.recalcular(25));
    expect(result.current.state.renglones.find((r) => r.factura_id === "f1")?.monto).toBe(0);
    await act(() => result.current.state.submit());
    expect(registrar).not.toHaveBeenCalled();
  });
  it("fallo de consulta no se trata como aprobación y permite reintentar", async () => {
    consultar.mockRejectedValue(new Error("red-fixture"));
    const { result } = montar();
    await waitFor(() => expect(result.current.preflight.fallo).toBe(true));
    expect(result.current.state.error).toMatch(/No se pudo verificar/);
    await act(() => result.current.state.submit());
    expect(registrar).not.toHaveBeenCalled();
    consultar.mockResolvedValue([estado("f1", "aprobada"), estado("f2", "aprobada")]);
    await act(() => result.current.preflight.reintentar());
    await waitFor(() => expect(result.current.state.saldoTotal).toBe(200));
    act(() => { result.current.state.setMetodo("Efectivo"); result.current.state.setMonto("f1", 12.5); result.current.state.setMonto("f2", 12.5); result.current.state.recalcular(25); });
    // FIFO25 por sí solo no alcanza a dos facturas: el usuario reparte12.50/12.50.
    act(() => { result.current.state.setMonto("f1", 12.5); result.current.state.setMonto("f2", 12.5); });
    expect(result.current.state.error).toBeNull();
  });
});
