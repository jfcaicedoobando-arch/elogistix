import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePortalDashboardKpis } from "../usePortalDashboardKpis";

const embarque = (overrides = {}) => ({
  id: "e1", modo: "MAR", tipo: "FCL", etd: null, eta: null, estado: "En Tránsito",
  ...overrides,
});

const factura = (overrides = {}) => ({
  estado: "Emitida", total: 1000, ...overrides,
});

describe("usePortalDashboardKpis", () => {
  it("filtra embarques activos (excluye Cerrado/Cancelado/EIR)", () => {
    const embarques = [
      embarque({ id: "e1", estado: "En Tránsito" }),
      embarque({ id: "e2", estado: "Cerrado" }),
      embarque({ id: "e3", estado: "Cancelado" }),
    ];
    const { result } = renderHook(() => usePortalDashboardKpis(embarques, []));
    expect(result.current.embarquesActivos).toHaveLength(1);
    expect(result.current.embarquesActivos[0].id).toBe("e1");
  });

  it("calcula montoFacturasPendientes y facturasVencidas", () => {
    const facturas = [
      factura({ estado: "Emitida", total: 500 }),
      factura({ estado: "Vencida", total: 300 }),
      factura({ estado: "Pagada", total: 999 }),
    ];
    const { result } = renderHook(() => usePortalDashboardKpis([], facturas));
    expect(result.current.montoFacturasPendientes).toBe(800);
    expect(result.current.facturasVencidas).toBe(1);
    expect(result.current.facturasPendientes).toHaveLength(2);
  });

  it("proximosArribos solo incluye ETAs en los próximos 14 días", () => {
    const hoy = new Date();
    const en5 = new Date(hoy.getTime() + 5 * 86400000).toISOString().slice(0, 10);
    const en30 = new Date(hoy.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const embarques = [
      embarque({ id: "e1", eta: en5, estado: "En Tránsito" }),
      embarque({ id: "e2", eta: en30, estado: "En Tránsito" }),
    ];
    const { result } = renderHook(() => usePortalDashboardKpis(embarques, []));
    expect(result.current.proximosArribos).toHaveLength(1);
    expect(result.current.proximosArribos[0].id).toBe("e1");
  });
});
