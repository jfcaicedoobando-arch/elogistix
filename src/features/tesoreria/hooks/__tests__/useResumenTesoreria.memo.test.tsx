import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CobranzaRow, CxpRow, ResumenCuenta } from "../../domain/resumen.types";

const state = vi.hoisted(() => ({
  cobranza: { data: [] as CobranzaRow[], isLoading: false, error: null, refetch: vi.fn() },
  cxp: { data: [] as CxpRow[], isLoading: false, error: null, refetch: vi.fn() },
  cuentas: { data: [] as ResumenCuenta[], isLoading: false, error: null, refetch: vi.fn() },
  rates: { data: { usdMxn: 20, eurMxn: 22, fechaAplicada: "2026-10-05" } },
}));
vi.mock("@/features/facturacion/hooks", () => ({ useCobranza: () => state.cobranza }));
vi.mock("@/features/cxp/hooks", () => ({ useFacturasCxP: () => state.cxp }));
vi.mock("../useTesoreriaCuentas", () => ({ useSaldosCuentas: () => state.cuentas }));
vi.mock("@/features/catalogos/hooks/useExchangeRates", () => ({ useExchangeRates: () => state.rates }));
vi.mock("@/features/tesoreria/domain", async (original) => {
  const domain = await original<typeof import("@/features/tesoreria/domain")>();
  return { ...domain, calcularResumenTesoreria: vi.fn(domain.calcularResumenTesoreria) };
});
import { calcularResumenTesoreria } from "@/features/tesoreria/domain";
import { useResumenTesoreria } from "../useResumenTesoreria";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date("2026-10-06T05:59:59Z"));
  vi.clearAllMocks();
  state.cuentas.data = [];
  state.cxp.data = [];
  state.cobranza.data = [];
  state.rates.data.usdMxn = 20;
});
afterEach(() => vi.useRealTimers());

describe("Tesorería computation work", () => {
  it.each([100, 1000, 5000])("computes %i rows once across ten unrelated renders", (size) => {
    state.cobranza.data = Array.from({ length: size }, (_, i) => ({
      id: String(i), numero: String(i), cliente_nombre: `Cliente ${i % 7}`,
      moneda: "MXN", saldo: 100, fecha_vencimiento: "2026-10-05", estatus_cobranza: "Vencida",
    }));
    const { result, rerender } = renderHook(() => useResumenTesoreria());
    const initial = result.current.data;
    for (let i = 0; i < 10; i++) rerender();
    expect(calcularResumenTesoreria).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe(initial);
    expect(result.current.data?.cartera_vencida_total_mxn).toBe(size * 100);
    state.cobranza.data = [...state.cobranza.data];
    rerender();
    expect(calcularResumenTesoreria).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(initial);
    state.rates.data.usdMxn = 21;
    rerender();
    expect(calcularResumenTesoreria).toHaveBeenCalledTimes(3);
  });

  it("updates the 30-day window at Mexico midnight without an unrelated render", () => {
    state.cobranza.data = [{ id: "1", numero: "1", cliente_nombre: "A", moneda: "MXN",
      saldo: 100, fecha_vencimiento: "2026-11-05", estatus_cobranza: "Pendiente" }];
    const { result } = renderHook(() => useResumenTesoreria());
    expect(result.current.data?.flujo.por_cobrar_mxn).toBe(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.data?.flujo.por_cobrar_mxn).toBe(100);
    expect(calcularResumenTesoreria).toHaveBeenCalledTimes(2);
  });
});
