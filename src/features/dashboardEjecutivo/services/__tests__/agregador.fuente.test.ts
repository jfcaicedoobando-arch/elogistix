/**
 * Verifica que el agregador respeta el parámetro `fuente`: cuando es
 * `"facturas"` debe usar `fetchEstadoResultadosDevengado`, y cuando es
 * `"embarques"` (o default) debe usar `fetchEstadoResultadosMes`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  fetchEstadoResultadosDevengado: vi.fn(),
  fetchEstadoResultadosMes: vi.fn(),
  fetchSaldosCuentas: vi.fn(),
  fetchResumenTesoreria: vi.fn(),
  fetchFlujoProyectado: vi.fn(),
  fetchPresupuestoVsReal: vi.fn(),
  calcularAlertas: vi.fn(),
  calcularKPIsEjecutivos: vi.fn(),
}));

vi.mock("@/features/profit/services/estadoResultadosDevengado", () => ({
  fetchEstadoResultadosDevengado: stubs.fetchEstadoResultadosDevengado,
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
    Object.values(stubs).forEach((s) => s.mockReset());
    stubs.fetchEstadoResultadosDevengado.mockResolvedValue(EERR_ZERO);
    stubs.fetchEstadoResultadosMes.mockResolvedValue(EERR_ZERO);
    stubs.fetchSaldosCuentas.mockResolvedValue([]);
    stubs.fetchResumenTesoreria.mockResolvedValue({
      cuentas: [], top_deudores: [], top_acreedores: [],
    });
    stubs.fetchFlujoProyectado.mockResolvedValue({});
    stubs.fetchPresupuestoVsReal.mockResolvedValue({});
    stubs.calcularAlertas.mockReturnValue([]);
    stubs.calcularKPIsEjecutivos.mockReturnValue({});
  });

  it("con fuente='facturas' usa fetchEstadoResultadosDevengado (14 veces)", async () => {
    await fetchDashboardEjecutivo({
      organizationId: "org-1", periodo: "2026-06",
      cobranza: [], cxp: [], fuente: "facturas",
    });
    expect(stubs.fetchEstadoResultadosDevengado).toHaveBeenCalledTimes(14);
    expect(stubs.fetchEstadoResultadosMes).not.toHaveBeenCalled();
  });

  it("con fuente='embarques' usa fetchEstadoResultadosMes (14 veces)", async () => {
    await fetchDashboardEjecutivo({
      organizationId: "org-1", periodo: "2026-06",
      cobranza: [], cxp: [], fuente: "embarques",
    });
    expect(stubs.fetchEstadoResultadosMes).toHaveBeenCalledTimes(14);
    expect(stubs.fetchEstadoResultadosDevengado).not.toHaveBeenCalled();
  });

  it("sin fuente explícita, default es 'embarques'", async () => {
    await fetchDashboardEjecutivo({
      organizationId: "org-1", periodo: "2026-06",
      cobranza: [], cxp: [],
    });
    expect(stubs.fetchEstadoResultadosMes).toHaveBeenCalledTimes(14);
    expect(stubs.fetchEstadoResultadosDevengado).not.toHaveBeenCalled();
  });
});
