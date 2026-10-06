/**
 * v13.823.367 — Regresión P1 #5 (seguimiento): en un embarque Borrador sin
 * actividad real el tab Utilidad no debe presentar pérdidas ficticias:
 * nada de "Δ MXN -", "-100.0%", comparativas Presupuestado vs. Real ni
 * alertas; sólo contexto y presupuesto.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabPnl } from "../TabPnl";

const mockUsePnlFinanciero = vi.fn();
vi.mock("@/features/embarques/hooks/usePnlFinanciero", () => ({
  usePnlFinanciero: (...args: unknown[]) => mockUsePnlFinanciero(...args),
}));
vi.mock("@/features/embarques/hooks/useFocusSection", () => ({
  useFocusSection: () => ({ registerRef: () => () => {} }),
}));
vi.mock("../pnl/PnlTipoCambioNota", () => ({
  PnlTipoCambioNota: () => null,
}));

const dataSinActividad = {
  venta: { real_mxn: 0, presupuestada_mxn: 100_000, pdte_cobro_mxn: 0 },
  costo: { real_mxn: 0, presupuestado_mxn: 80_000, pdte_pago_mxn: 0 },
  por_concepto: [
    { concepto: "Flete", presupuestado_mxn: 100_000, real_mxn: 0 },
  ],
  por_concepto_costo: [
    { concepto: "Flete", presupuestado_mxn: 80_000, real_mxn: 0 },
  ],
  por_proveedor: [],
  tipo_cambio_usd: 17.5,
  tipo_cambio_eur: 19,
};

const dataConActividad = {
  ...dataSinActividad,
  venta: { real_mxn: 60_000, presupuestada_mxn: 100_000, pdte_cobro_mxn: 60_000 },
};

beforeEach(() => {
  mockUsePnlFinanciero.mockReturnValue({
    data: dataSinActividad,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe("TabPnl — Borrador sin actividad real", () => {
  it("muestra contexto sin deltas negativos, comparativas ni alertas", () => {
    const { container } = render(
      <TabPnl embarqueId="emb-1" estadoEmbarque="Borrador" />,
    );

    expect(screen.getByText("Sin actividad real todavía")).toBeTruthy();
    // KPI neutrales: contexto de presupuesto, sin Δ.
    expect(screen.getAllByText(/^Presup\./).length).toBe(4);
    expect(container.textContent).not.toContain("Δ");
    expect(container.textContent).not.toMatch(/-100\.0\s*%/);
    expect(container.textContent).not.toMatch(/Δ MXN -/);
    // Sin comparativas Presupuestado vs. Real ni alertas financieras.
    expect(screen.queryByText(/Presupuestado vs\. Real/)).toBeNull();
    expect(screen.queryByText("Alertas financieras")).toBeNull();
  });
});

describe("TabPnl — embarque con actividad real conserva comparativas", () => {
  it("renderiza las comparativas Presupuestado vs. Real", () => {
    mockUsePnlFinanciero.mockReturnValue({
      data: dataConActividad,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<TabPnl embarqueId="emb-2" estadoEmbarque="Confirmado" />);

    expect(screen.queryByText("Sin actividad real todavía")).toBeNull();
    expect(
      screen.getByText("Ingresos por concepto (Presupuestado vs. Real)"),
    ).toBeTruthy();
    expect(
      screen.getByText("Costos por concepto (Presupuestado vs. Real)"),
    ).toBeTruthy();
  });
});


describe("audit129 incomplete supplier costs", () => {
  it("qualifies the result, avoids a definitive100% and recovers after capture", () => {
    const result = { data: { ...dataConActividad, estado_costos: "incompleto", utilidad_mxn: null },
      isLoading: false, error: null, refetch: vi.fn() };
    mockUsePnlFinanciero.mockReturnValue(result);
    const { rerender } = render(<TabPnl embarqueId="partial" />);
    expect(screen.getByText("Costos incompletos")).toBeTruthy();
    expect(screen.getAllByText("No calculable")).toHaveLength(2);
    expect(screen.queryByText("100.0%")).toBeNull();
    mockUsePnlFinanciero.mockReturnValue({ ...result, data: {
      ...result.data, estado_costos: "completo", utilidad_mxn: 20000,
      costo: { real_mxn: 40000, presupuestado_mxn: 80000, pdte_pago_mxn: 40000 },
    } });
    rerender(<TabPnl embarqueId="partial" />);
    expect(screen.queryByText("Costos incompletos")).toBeNull();
    expect(screen.queryByText("No calculable")).toBeNull();
  });
});


it("audit130 identifica repartos provisionales por sobreasignación", () => {
  mockUsePnlFinanciero.mockReturnValue({
    data: { ...dataConActividad, estado_costos: "incompleto", utilidad_mxn: null,
      facturas_sobreasignadas: 1, costo_sobreasignado_mxn: 20 },
    isLoading: false, error: null, refetch: vi.fn(),
  });
  render(<TabPnl embarqueId="sobreasignado" />);
  expect(screen.getByText(/reparto proporcional provisional/)).toBeTruthy();
  expect(screen.getAllByText("No calculable")).toHaveLength(2);
});
