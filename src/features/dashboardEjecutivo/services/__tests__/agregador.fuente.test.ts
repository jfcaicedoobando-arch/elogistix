/**
 * Verifica que el agregador respeta el parámetro `fuente`: cuando es
 * `"facturas"` debe usar `fetchEstadoResultadosDevengado`, y cuando es
 * `"embarques"` (o default) debe usar `fetchEstadoResultadosMes`.
 *
 * Actual y previo usan el servicio completo; la tendencia devengada usa
 * el mismo criterio mensual en lecturas por rango anual.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const stubs = vi.hoisted(() => ({
  fetchEstadoResultadosDevengado: vi.fn(),
  fetchEstadoResultadosDevengadoAnual: vi.fn(),
  fetchEstadoResultadosMes: vi.fn(),
  fetchSaldosCuentas: vi.fn(),
  fetchResumenTesoreria: vi.fn(),
  fetchFlujoProyectado: vi.fn(),
  fetchPresupuestoVsReal: vi.fn(),
  fetchExchangeRates: vi.fn(),
  calcularAlertas: vi.fn(),
  calcularKPIsEjecutivos: vi.fn(),
}));

vi.mock("@/features/profit/services/estadoResultadosDevengado", () => ({
  fetchEstadoResultadosDevengado: stubs.fetchEstadoResultadosDevengado,
  fetchEstadoResultadosDevengadoAnual: stubs.fetchEstadoResultadosDevengadoAnual,
}));
vi.mock("@/features/profit/services/estadoResultados", () => ({
  fetchEstadoResultadosMes: stubs.fetchEstadoResultadosMes,
}));
vi.mock("@/features/tesoreria/services", () => ({
  fetchSaldosCuentas: stubs.fetchSaldosCuentas,
  fetchResumenTesoreria: stubs.fetchResumenTesoreria,
  fetchFlujoProyectado: stubs.fetchFlujoProyectado,
}));
vi.mock("@/features/presupuesto/services", () => ({
  fetchPresupuestoVsReal: stubs.fetchPresupuestoVsReal,
}));
vi.mock("@/features/catalogos/services", () => ({
  fetchExchangeRates: stubs.fetchExchangeRates,
}));
vi.mock("../alertas", () => ({
  calcularAlertas: stubs.calcularAlertas,
  calcularKPIsEjecutivos: stubs.calcularKPIsEjecutivos,
}));

import { fetchDashboardEjecutivo } from "../agregador";

const EERR_ZERO = {
  totalIngresos: { total: 0 },
  totalCostos: { total: 0 },
  utilidad: { total: 0 },
};

describe("agregador — selección de fuente EERR", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: [], error: null });
    Object.values(stubs).forEach((s) => s.mockReset());
    stubs.fetchEstadoResultadosDevengado.mockResolvedValue(EERR_ZERO);
    stubs.fetchEstadoResultadosDevengadoAnual.mockResolvedValue([]);
    stubs.fetchEstadoResultadosMes.mockResolvedValue(EERR_ZERO);
    stubs.fetchSaldosCuentas.mockResolvedValue([]);
    stubs.fetchResumenTesoreria.mockResolvedValue({
      cuentas: [], top_deudores: [], top_acreedores: [],
    });
    stubs.fetchFlujoProyectado.mockResolvedValue({});
    stubs.fetchPresupuestoVsReal.mockResolvedValue({});
    stubs.fetchExchangeRates.mockResolvedValue({ usdMxn: 17.5, eurMxn: 18 });
    stubs.calcularAlertas.mockReturnValue([]);
    stubs.calcularKPIsEjecutivos.mockReturnValue({});
  });

  it("con fuente='facturas' usa devengado mensual y anual sin RPC bruto", async () => {
    await fetchDashboardEjecutivo({
      organizationId: "org-1", periodo: "2026-06",
      cobranza: [], cxp: [], fuente: "facturas",
    });
    expect(stubs.fetchEstadoResultadosDevengado).toHaveBeenCalledTimes(2);
    expect(stubs.fetchEstadoResultadosMes).not.toHaveBeenCalled();
    expect(stubs.fetchEstadoResultadosDevengadoAnual).toHaveBeenCalledTimes(2);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("con fuente='embarques' usa fetchEstadoResultadosMes (actual + previo) y RPC anual", async () => {
    await fetchDashboardEjecutivo({
      organizationId: "org-1", periodo: "2026-06",
      cobranza: [], cxp: [], fuente: "embarques",
    });
    expect(stubs.fetchEstadoResultadosMes).toHaveBeenCalledTimes(2);
    expect(stubs.fetchEstadoResultadosDevengado).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith("eerr_resumen_anual", expect.objectContaining({ p_fuente: "embarques" }));
  });

  it("sin fuente explícita, default es 'embarques'", async () => {
    await fetchDashboardEjecutivo({
      organizationId: "org-1", periodo: "2026-06",
      cobranza: [], cxp: [],
    });
    expect(stubs.fetchEstadoResultadosMes).toHaveBeenCalledTimes(2);
    expect(stubs.fetchEstadoResultadosDevengado).not.toHaveBeenCalled();
  });
});
