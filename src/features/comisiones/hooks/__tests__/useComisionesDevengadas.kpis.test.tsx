import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  kpiRows: vi.fn(),
  liquidado: vi.fn(),
  calcular: vi.fn(),
}));
vi.mock("@/features/comisiones/services", () => ({
  fetchComisionesDevengadas: mocks.list,
  fetchComisionesKpiRows: mocks.kpiRows,
  fetchLiquidadoMxnPorMes: mocks.liquidado,
  calcularKPIsComisiones: mocks.calcular,
}));

import { useComisionesDevengadas } from "../useComisionesDevengadas";

describe("useComisionesDevengadas · estado de KPIs", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.list.mockResolvedValue([{ id: "comision-visible" }]);
    mocks.calcular.mockReturnValue({ devengado_mes_mxn: 40, pendiente_liquidar_mxn: 40, por_recuperar_mxn: 0 });
  });

  it("conserva la lista pero no inventa KPIs cero si falla su lectura", async () => {
    mocks.kpiRows.mockRejectedValue(new Error("KPI no disponible"));
    mocks.liquidado.mockResolvedValue(0);
    const { result } = renderHook(() => useComisionesDevengadas(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.kpisError).toBe(true));
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual([{ id: "comision-visible" }]);
    expect(result.current.kpis).toBeNull();
  });

  it("no muestra liquidado=0 si falla la consulta de liquidaciones", async () => {
    mocks.kpiRows.mockResolvedValue([]);
    mocks.liquidado.mockRejectedValue(new Error("Liquidaciones no disponibles"));
    const { result } = renderHook(() => useComisionesDevengadas(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.kpisError).toBe(true));
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.kpis).toBeNull();
  });
});
