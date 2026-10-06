import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  cobranza: { data: [], kpis: {}, isLoading: false, error: null as Error | null, refetch: vi.fn() },
  cxp: { data: [], kpis: {}, isLoading: false, error: null, refetch: vi.fn() },
  tesoreria: { data: {}, isLoading: false, error: null, refetch: vi.fn() },
  ejecutivo: vi.fn(() => ({ data: {}, isLoading: true })),
}));
vi.mock("@/features/facturacion/hooks", () => ({ useCobranza: () => state.cobranza }));
vi.mock("@/features/cxp/hooks", () => ({ useFacturasCxP: () => state.cxp }));
vi.mock("@/features/tesoreria/hooks", () => ({ useResumenTesoreria: () => state.tesoreria }));
vi.mock("@/features/facturacion/hooks/useDashboardEjecutivoFacturacion", () => ({ useDashboardEjecutivoFacturacion: state.ejecutivo }));
vi.mock("@/features/facturacion/hooks/useHuecoFacturacion", () => ({ useHuecoFacturacion: () => ({ isLoading: false }) }));
vi.mock("@/features/dashboard/hooks/useEmbarquesPendientesAdmin", () => ({ useEmbarquesPendientesAdmin: () => ({ data: {} }) }));
vi.mock("@/features/cxp/services", () => ({ esFacturaPorPagar: () => true }));
import { useFinanceDashboard } from "../useFinanceDashboard";
beforeEach(() => { vi.clearAllMocks(); state.cobranza.error = null; state.cobranza.isLoading = false; });
describe("Finance dashboard query ownership", () => {
  it("does not subscribe to unused executive KPIs or wait for them", () => {
    const { result } = renderHook(() => useFinanceDashboard());
    expect(state.ejecutivo).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
  it("keeps critical pending and error states, and retries each source through Treasury", () => {
    state.cobranza.isLoading = true;
    const { result, rerender } = renderHook(() => useFinanceDashboard());
    expect(result.current.isLoading).toBe(true);
    state.cobranza.error = new Error("CxC unavailable");
    rerender();
    expect(result.current.error).toBe(state.cobranza.error);
    result.current.refetch();
    expect(state.tesoreria.refetch).toHaveBeenCalledTimes(1);
    expect(state.cobranza.refetch).not.toHaveBeenCalled();
    expect(state.cxp.refetch).not.toHaveBeenCalled();
  });
});
