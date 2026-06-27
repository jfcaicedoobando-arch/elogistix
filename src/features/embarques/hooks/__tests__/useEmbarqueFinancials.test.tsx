import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { mockCompute } = vi.hoisted(() => ({ mockCompute: vi.fn() }));

vi.mock("@/features/embarques/domain/embarqueKpis", () => ({
  computeEmbarqueKpis: mockCompute,
}));

import { useEmbarqueFinancials } from "../useEmbarqueFinancials";

describe("useEmbarqueFinancials", () => {
  // v13.137.36: reset por test del mock hoisted; sin esto, los conteos
  // (`toHaveBeenCalledTimes(1|2)`) acumulan llamadas entre tests.
  beforeEach(() => { mockCompute.mockReset(); });

  it("delega el cálculo a computeEmbarqueKpis y retorna el resultado", () => {
    const kpis = { totalVentaUSD: 1000, totalCostoUSD: 800, utilidadUSD: 200 };
    mockCompute.mockReturnValue(kpis);
    const { result } = renderHook(() =>
      useEmbarqueFinancials({
        conceptosVenta: [],
        conceptosCosto: [],
        tipoCambioUSD: 17,
        tipoCambioEUR: 18,
      }),
    );
    expect(result.current).toEqual(kpis);
    expect(mockCompute).toHaveBeenCalledWith([], [], 17, 18);
  });

  it("recalcula cuando cambian los tipos de cambio", () => {
    mockCompute.mockReturnValue({ totalVentaUSD: 0 });
    const { rerender } = renderHook(
      ({ usd, eur }: { usd: number; eur: number }) =>
        useEmbarqueFinancials({ conceptosVenta: [], conceptosCosto: [], tipoCambioUSD: usd, tipoCambioEUR: eur }),
      { initialProps: { usd: 17, eur: 18 } },
    );
    rerender({ usd: 18, eur: 19 });
    expect(mockCompute).toHaveBeenCalledTimes(2);
    expect(mockCompute).toHaveBeenLastCalledWith([], [], 18, 19);
  });

  it("no recalcula si los inputs no cambiaron (memo)", () => {
    mockCompute.mockReturnValue({ totalVentaUSD: 0 });
    const ventas: never[] = [];
    const costos: never[] = [];
    const { rerender } = renderHook(() =>
      useEmbarqueFinancials({ conceptosVenta: ventas, conceptosCosto: costos, tipoCambioUSD: 17, tipoCambioEUR: 18 }),
    );
    rerender();
    expect(mockCompute).toHaveBeenCalledTimes(1);
  });
});
