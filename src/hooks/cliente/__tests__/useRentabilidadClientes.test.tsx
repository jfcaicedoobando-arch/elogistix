import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useRentabilidadClientes } from "../useRentabilidadClientes";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/services/reportes", () => ({
  fetchReportesResumen: vi.fn().mockResolvedValue({
    clientes: [{ id: "1", nombre: "Client A", profit: 500 }],
    kpis: { totalClientes: 1, revenue: 1000, profit: 500, margenProm: 50 },
  }),
}));

describe("useRentabilidadClientes", () => {
  it("fetches profitability data and provides KPIs", async () => {
    const { result } = renderHook(() => useRentabilidadClientes({}), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.clientes).toHaveLength(1);
    expect(result.current.kpis.profit).toBe(500);
  });
});
