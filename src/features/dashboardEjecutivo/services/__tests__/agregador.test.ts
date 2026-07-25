/**
 * Test del agregador del Dashboard Ejecutivo.
 *
 * Mockeamos todos los servicios upstream para verificar:
 * - que se invocan con los parámetros correctos (periodo actual, anterior, 12 meses),
 * - que `flujo` se resuelve DESPUÉS de `cuentas` (segunda fase),
 * - que el snapshot final incluye kpis/alertas/top deudores/acreedores.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const fetchEstadoResultadosDevengado = vi.fn();
const fetchSaldosCuentas = vi.fn();
const fetchResumenTesoreria = vi.fn();
const fetchFlujoProyectado = vi.fn();
const fetchPresupuestoVsReal = vi.fn();
const fetchExchangeRates = vi.fn();

vi.mock("@/features/profit/services/estadoResultadosDevengado", () => ({
  fetchEstadoResultadosDevengado: (...args: unknown[]) =>
    fetchEstadoResultadosDevengado(...args),
}));
vi.mock("@/features/tesoreria/services", () => ({
  fetchSaldosCuentas: (...args: unknown[]) => fetchSaldosCuentas(...args),
  fetchResumenTesoreria: (...args: unknown[]) => fetchResumenTesoreria(...args),
  fetchFlujoProyectado: (...args: unknown[]) => fetchFlujoProyectado(...args),
}));
vi.mock("@/features/presupuesto/services", () => ({
  fetchPresupuestoVsReal: (...args: unknown[]) => fetchPresupuestoVsReal(...args),
}));
vi.mock("@/features/catalogos/services", () => ({
  fetchExchangeRates: (...args: unknown[]) => fetchExchangeRates(...args),
}));

const calcularAlertasMock = vi.fn((...args: unknown[]) => {
  void args;
  return [{ id: "a1", severidad: "alta" }];
});
const calcularKPIsEjecutivosMock = vi.fn((...args: unknown[]) => {
  void args;
  return { ingresos: 100 };
});
vi.mock("../alertas", () => ({
  calcularAlertas: (...args: unknown[]) => calcularAlertasMock(args[0]),
  calcularKPIsEjecutivos: (...args: unknown[]) => calcularKPIsEjecutivosMock(args[0], args[1]),
}));

import { fetchDashboardEjecutivo } from "../agregador";

function eerr(total: number) {
  return {
    totalIngresos: { total },
    totalCostos: { total: total / 2 },
    utilidad: { total: total / 2 },
  };
}

describe("dashboardEjecutivo/agregador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchEstadoResultadosDevengado.mockResolvedValue(eerr(100));
    fetchSaldosCuentas.mockResolvedValue([{ id: "c1", saldo: 500 }]);
    fetchResumenTesoreria.mockResolvedValue({
      top_deudores: [{ cliente: "X", monto: 1 }],
      top_acreedores: [{ proveedor: "Y", monto: 2 }],
    });
    fetchFlujoProyectado.mockResolvedValue({ semanas: [] });
    fetchPresupuestoVsReal.mockResolvedValue({ filas: [] });
    fetchExchangeRates.mockResolvedValue({ usdMxn: 17.5, eurMxn: 18 });
  });

  it("invoca EERR para periodo, periodo anterior y 12 meses hacia atrás", async () => {
    await fetchDashboardEjecutivo({
      organizationId: "org-1",
      periodo: "2025-03",
      cobranza: [],
      cxp: [],
      fuente: "facturas",
    });
    // 1 actual + 1 previo + 12 meses = 14
    expect(fetchEstadoResultadosDevengado).toHaveBeenCalledTimes(14);
    // periodo anterior debe ser 2025-02
    const calls = fetchEstadoResultadosDevengado.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual({ organizationId: "org-1", year: 2025, month: 2 });
    expect(calls).toContainEqual({ organizationId: "org-1", year: 2025, month: 3 });
  });

  it("calcula correctamente el cruce de año en periodo anterior", async () => {
    await fetchDashboardEjecutivo({
      organizationId: null,
      periodo: "2025-01",
      cobranza: [],
      cxp: [],
      fuente: "facturas",
    });
    const calls = fetchEstadoResultadosDevengado.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual({ organizationId: null, year: 2024, month: 12 });
  });

  it("resuelve flujo DESPUÉS de cuentas pasándole el resultado", async () => {
    await fetchDashboardEjecutivo({
      organizationId: "org-1",
      periodo: "2025-06",
      cobranza: [{ id: "c" }] as never,
      cxp: [],
      fuente: "facturas",
    });
    expect(fetchFlujoProyectado).toHaveBeenCalledTimes(1);
    expect(fetchFlujoProyectado).toHaveBeenCalledWith({
      cuentas: [{ id: "c1", saldo: 500 }],
      cobranza: [{ id: "c" }],
      cxp: [],
      dias: 28,
      organizationId: "org-1",
      tipoCambioUsd: 17.5,
    });
  });

  it("construye snapshot completo con kpis, alertas y tops", async () => {
    const snap = await fetchDashboardEjecutivo({
      organizationId: "org-1",
      periodo: "2025-06",
      cobranza: [],
      cxp: [],
      fuente: "facturas",
    });
    expect(snap.periodo).toBe("2025-06");
    expect(snap.kpis).toEqual({ ingresos: 100 });
    expect(snap.alertas).toEqual([{ id: "a1", severidad: "alta" }]);
    expect(snap.topDeudores).toEqual([{ cliente: "X", monto: 1 }]);
    expect(snap.topAcreedores).toEqual([{ proveedor: "Y", monto: 2 }]);
    expect(snap.eerr12m).toHaveLength(12);
    expect(typeof snap.generadoEn).toBe("string");
  });
});
