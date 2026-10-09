import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEstadoCuentaVista } from "../useEstadoCuentaVista";
const h = vi.hoisted(() => ({ rows: [{
  id: "A8", numero: "A8", expediente: "EXP", moneda: "MXN", saldo: .01, total: 1.16, pagado: 1.15,
  notas_credito_aplicadas: 0, dias_vencido: 1, fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-02",
}] }));
vi.mock("../useEstadoCuenta", () => ({ useEstadoCuenta: () => ({ rows: h.rows, kpis: {}, isLoading: false }) }));
vi.mock("../useEstadoCuentaDateRange", () => ({ useEstadoCuentaDateRange: () => ({
  desde: null, hasta: null, presetActivo: "historico", aplicarPreset: vi.fn(),
}) }));

describe("AUD54: filtro interactivo de antigüedad", () => {
  it("seleccionar y quitar bucket mantiene A8 y su centavo en filas y subtotales", () => {
    const { result } = renderHook(() => useEstadoCuentaVista(["c1"], true));
    act(() => result.current.toggleBucket("d_1_30"));
    expect(result.current.filtradas.map((f) => f.id)).toEqual(["A8"]);
    expect(result.current.grupos[0].saldo).toBe(.01);
    expect(result.current.aging.find((b) => b.id === "d_1_30")?.conteo).toBe(1);
    act(() => result.current.toggleBucket("d_1_30"));
    expect(result.current.bucket).toBeNull();
    expect(result.current.filtradas).toHaveLength(1);
  });
});
