import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/hooks/catalogos/useTasaIVA", () => ({
  useTasaIVA: () => 0.16,
}));

vi.mock("@/lib/supabase/cast", () => ({
  fromDb: <T,>(v: T): T => v,
}));

import { usePortalCotizacionDetalle } from "../usePortalCotizacionDetalle";

const conceptosVenta = [
  { moneda: "USD", total: 500, cantidad: 1, precio_unitario: 500 },
  { moneda: "USD", total: 300, cantidad: 1, precio_unitario: 300 },
  { moneda: "MXN", total: 1160, cantidad: 2, precio_unitario: 500 },
];

describe("usePortalCotizacionDetalle", () => {
  it("happy path: separa conceptos USD y MXN y calcula totales", () => {
    const { result } = renderHook(() =>
      usePortalCotizacionDetalle({ conceptos_venta: conceptosVenta }),
    );

    expect(result.current.conceptosUSD).toHaveLength(2);
    expect(result.current.conceptosMXN).toHaveLength(1);
    expect(result.current.totalUSD).toBe(800);
    // subtotalMXN = 2 * 500 = 1000
    expect(result.current.subtotalMXN).toBe(1000);
    expect(result.current.ivaMXN).toBeCloseTo(160, 1);
    expect(result.current.totalMXN).toBeCloseTo(1160, 1);
  });

  it("error path: retorna ceros cuando cot es null", () => {
    const { result } = renderHook(() => usePortalCotizacionDetalle(null));

    expect(result.current.conceptosUSD).toHaveLength(0);
    expect(result.current.conceptosMXN).toHaveLength(0);
    expect(result.current.totalUSD).toBe(0);
    expect(result.current.totalMXN).toBe(0);
  });

  it("retorna ceros cuando conceptos_venta no es array", () => {
    const { result } = renderHook(() =>
      usePortalCotizacionDetalle({ conceptos_venta: null }),
    );
    expect(result.current.totalUSD).toBe(0);
    expect(result.current.subtotalMXN).toBe(0);
  });
});
