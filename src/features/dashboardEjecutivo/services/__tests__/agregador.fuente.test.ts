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

  it("conserva completitud y nominales de cada mes de la tendencia devengada", async () => {
    const valuacion = { completa: false, conceptos_sin_tc_count: 1, excluidos_sin_tc: [{ embarque_id: "e1", concepto: "Flete", moneda: "USD", nominal: 100, seccion: "costos", modo: "Marítimo" }] };
    stubs.fetchEstadoResultadosDevengadoAnual.mockResolvedValue([{ mes: 6, ingresos_mxn: 1000, costos_mxn: 0, valuacion }]);
    const result = await fetchDashboardEjecutivo({organizationId: "org-1", periodo: "2026-06", cobranza: [], cxp: [], fuente: "facturas"});
    expect(result.eerr12m.find((p) => p.periodo === "2026-06")?.valuacion).toEqual(valuacion);
  });

  it("RPC operativa sin contrato conserva cifras conocidas y marca incertidumbre, no error", async () => {
    rpcMock.mockResolvedValue({ data: [{mes: 6, ingresos_mxn: 100, costos_mxn: 25}], error: null });
    const result = await fetchDashboardEjecutivo({organizationId: "org-1", periodo: "2026-06", cobranza: [], cxp: [], fuente: "embarques"});
    expect(result.eerr12m.find((p) => p.periodo === "2026-06")).toMatchObject({ingresos:100,costos:25,utilidad:75,valuacion_no_verificada:true});
    expect(result.eerr12m.find((p) => p.periodo === "2026-06")?.valuacion).toBeUndefined();
  });

  it("cero verificado no se convierte en valuación desconocida", async () => {
    rpcMock.mockResolvedValue({ data: [{mes: 6, ingresos_mxn: 0, costos_mxn: 0, valuacion:{completa:true,conceptos_sin_tc_count:0,excluidos_sin_tc:[]}}], error: null });
    const result = await fetchDashboardEjecutivo({organizationId: "org-1", periodo: "2026-06", cobranza: [], cxp: [], fuente: "embarques"});
    expect(result.eerr12m.find((p) => p.periodo === "2026-06")?.valuacion?.completa).toBe(true);
    expect(result.eerr12m.find((p) => p.periodo === "2026-06")?.valuacion_no_verificada).toBeUndefined();
  });

  it.each(["facturas", "embarques", undefined] as const)(
    "alerta EERR parcial conserva el mes histórico y la fuente %s",
    async (fuente) => {
      stubs.calcularKPIsEjecutivos.mockReturnValue({ eerr_incompleto: true });
      const result = await fetchDashboardEjecutivo({
        organizationId: "org-1", periodo: "2026-06", cobranza: [], cxp: [], fuente,
      });
      const alerta = result.alertas.find((a) => a.id === "eerr-valuacion-incompleta");
      const destino = new URL(alerta!.url!, "https://example.test");
      expect(destino.pathname).toBe("/profit/estado-resultados");
      expect(destino.searchParams.get("mes")).toBe("2026-06");
      expect(destino.searchParams.get("fuente")).toBe(fuente ?? "embarques");
    },
  );

  describe.each(["facturas", "embarques", undefined] as const)("navegación provisional con fuente %s", (fuente) => {
    it.each(["actual", "previo", "presupuesto", "tendencia"] as const)(
      "NC sin base en %s conserva advertencia y contexto histórico en ambas alertas",
      async (origen) => {
        const eerrConNc = { ...EERR_ZERO, notas_proveedor_sin_base: [{ id: "nc-1" }, { id: "nc-2" }] };
        const lector = fuente === "facturas" ? stubs.fetchEstadoResultadosDevengado : stubs.fetchEstadoResultadosMes;
        if (origen === "actual") lector.mockResolvedValueOnce(eerrConNc);
        if (origen === "previo") lector.mockResolvedValueOnce(EERR_ZERO).mockResolvedValueOnce(eerrConNc);
        if (origen === "presupuesto") stubs.fetchPresupuestoVsReal.mockResolvedValue({ notas_proveedor_sin_base_count: 2 });
        if (origen === "tendencia") {
          const filas = [{ mes: 6, ingresos_mxn: 100, costos_mxn: 25, notas_proveedor_sin_base_count: 2 }];
          if (fuente === "facturas") stubs.fetchEstadoResultadosDevengadoAnual.mockResolvedValue(filas);
          else rpcMock.mockResolvedValue({ data: filas, error: null });
        }
        stubs.calcularKPIsEjecutivos.mockReturnValue({ eerr_incompleto: true });
        const result = await fetchDashboardEjecutivo({
          organizationId: "org-1", periodo: "2026-06", cobranza: [], cxp: [], fuente,
        });
        const provisional = result.alertas.find((a) => a.id === "nc-proveedor-sin-base");
        expect(provisional).toMatchObject({
          severidad: "warning", titulo: "Resultados provisionales",
          descripcion: "Reporte provisional: 2 nota(s) de crédito de proveedor sin base sin impuestos quedaron fuera del gasto. Los costos y la utilidad están incompletos; no se infieren impuestos ni se modifican datos históricos.",
        });
        const parcial = result.alertas.find((a) => a.id === "eerr-valuacion-incompleta");
        for (const alerta of [provisional, parcial]) {
          const destino = new URL(alerta!.url!, "https://example.test");
          expect(destino.pathname).toBe("/profit/estado-resultados");
          expect(Object.fromEntries(destino.searchParams)).toEqual({ mes: "2026-06", fuente: fuente ?? "embarques" });
        }
        expect(provisional!.url).toBe(parcial!.url);
      },
    );
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

