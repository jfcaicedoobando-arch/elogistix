/**
 * Ola de exactitud financiera (v13.823.5): el agregador debe propagar el TC EUR
 * y su fecha a tesorería y flujo, y omitirlo cuando es estimado (fallback).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const fetchEstadoResultadosMes = vi.fn();
const fetchSaldosCuentas = vi.fn();
const calcularResumenTesoreria = vi.fn();
const calcularFlujoProyectado = vi.fn();
const fetchPresupuestoVsReal = vi.fn();
const fetchExchangeRates = vi.fn();

vi.mock("@/features/profit/services/estadoResultados", () => ({
  fetchEstadoResultadosMes: (...args: unknown[]) => fetchEstadoResultadosMes(...args),
}));
vi.mock("@/features/tesoreria/domain", () => ({
  calcularResumenTesoreria: (...args: unknown[]) => calcularResumenTesoreria(...args),
  calcularFlujoProyectado: (...args: unknown[]) => calcularFlujoProyectado(...args),
}));
vi.mock("@/features/presupuesto/services", () => ({
  fetchPresupuestoVsReal: (...args: unknown[]) => fetchPresupuestoVsReal(...args),
}));
vi.mock("@/features/catalogos/services", () => ({
  fetchExchangeRates: (...args: unknown[]) => fetchExchangeRates(...args),
  EXCHANGE_RATES_FALLBACK: { usdMxn: 17.25, eurMxn: 18.5, esFallback: true },
}));
vi.mock("../alertas", () => ({
  calcularAlertas: () => [],
  calcularKPIsEjecutivos: () => ({}),
}));

import { probarSnapshotEjecutivo, type SnapshotFixtureParams } from "./snapshotFixture";

function fetchDashboardEjecutivo(params: SnapshotFixtureParams) {
  return probarSnapshotEjecutivo(params, fetchSaldosCuentas());
}

const eerr = { totalIngresos: { total: 100 }, totalCostos: { total: 50 }, utilidad: { total: 50 } };

describe("agregador: propagación del TC EUR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ data: [], error: null });
    fetchEstadoResultadosMes.mockResolvedValue(eerr);
    fetchSaldosCuentas.mockResolvedValue([
      { id: "c1", alias: "MXN", banco: "B", moneda: "MXN", saldo: 100 },
      { id: "c2", alias: "USD", banco: "B", moneda: "USD", saldo: 10 },
      { id: "c3", alias: "EUR", banco: "B", moneda: "EUR", saldo: 5 },
    ]);
    calcularResumenTesoreria.mockReturnValue({ top_deudores: [], top_acreedores: [] });
    calcularFlujoProyectado.mockReturnValue({ semanas: [] });
    fetchPresupuestoVsReal.mockResolvedValue({ filas: [] });
  });

  it("propaga eurMxn y fecha a tesorería y flujo cuando el TC es real", async () => {
    fetchExchangeRates.mockResolvedValue({
      usdMxn: 20, eurMxn: 22, fechaAplicada: "2026-09-01", esFallback: false, eurEsFallback: false,
    });
    await fetchDashboardEjecutivo({ organizationId: "org-1", periodo: "2026-09", cobranza: [], cxp: [] });

    expect(calcularResumenTesoreria).toHaveBeenCalledWith(expect.objectContaining({
      tipoCambioUsd: 20, tipoCambioEur: 22, tipoCambioFecha: "2026-09-01",
    }));
    expect(calcularFlujoProyectado).toHaveBeenCalledWith(expect.objectContaining({
      tipoCambioUsd: 20, tipoCambioEur: 22, tipoCambioFecha: "2026-09-01",
    }));
  });

  it("omite el TC EUR cuando es estimado, para que el dominio marque incompleto", async () => {
    fetchExchangeRates.mockResolvedValue({
      usdMxn: 20, eurMxn: 18.5, fechaAplicada: "2026-09-01", esFallback: false, eurEsFallback: true,
    });
    await fetchDashboardEjecutivo({ organizationId: "org-1", periodo: "2026-09", cobranza: [], cxp: [] });

    const args = calcularResumenTesoreria.mock.calls[0][0] as { tipoCambioEur?: number; tipoCambioUsd: number };
    expect(args.tipoCambioEur).toBeUndefined();
    expect(args.tipoCambioUsd).toBe(20);
    const argsFlujo = calcularFlujoProyectado.mock.calls[0][0] as { tipoCambioEur?: number };
    expect(argsFlujo.tipoCambioEur).toBeUndefined();
  });
});
