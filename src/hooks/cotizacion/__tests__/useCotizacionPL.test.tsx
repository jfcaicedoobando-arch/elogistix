import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCotizacionPL } from "../useCotizacionPL";

const filas = [
  { id: "1", cantidad: 2, costo_unitario: 100, precio_venta: 150, moneda: "USD" as const, proveedor_id: "p1", concepto: "Flete" },
  { id: "2", cantidad: 1, costo_unitario: 50, precio_venta: 80, moneda: "USD" as const, proveedor_id: "p1", concepto: "THC" },
  { id: "3", cantidad: 3, costo_unitario: 200, precio_venta: 300, moneda: "MXN" as const, proveedor_id: "p2", concepto: "Maniobras" },
];

describe("useCotizacionPL", () => {
  it("separa costos por moneda y calcula totales independientes", () => {
    const { result } = renderHook(() => useCotizacionPL(filas));
    expect(result.current.costosUSD).toHaveLength(2);
    expect(result.current.costosMXN).toHaveLength(1);

    expect(result.current.plUSD.totalCosto).toBe(250); // 2*100 + 50
    expect(result.current.plUSD.totalVenta).toBe(380); // 2*150 + 80
    expect(result.current.plUSD.profit).toBe(130);

    expect(result.current.plMXN.totalCosto).toBe(600);
    expect(result.current.plMXN.totalVenta).toBe(900);
    expect(result.current.plMXN.profit).toBe(300);
  });

  it("devuelve totales en cero cuando no hay filas", () => {
    const { result } = renderHook(() => useCotizacionPL([]));
    expect(result.current.plUSD.totalCosto).toBe(0);
    expect(result.current.plMXN.totalCosto).toBe(0);
    expect(result.current.plUSD.porcentaje).toBe(0);
  });

  it("memoiza derivaciones entre re-renders con la misma referencia", () => {
    const { result, rerender } = renderHook(({ f }) => useCotizacionPL(f), {
      initialProps: { f: filas },
    });
    const first = result.current.plUSD;
    rerender({ f: filas });
    expect(result.current.plUSD).toBe(first);
  });
});
