/**
 * v13.823.367 — Regresión P1 #5 (seguimiento): en un embarque Borrador sin
 * actividad real el tab Utilidad no debe presentar pérdidas ficticias:
 * nada de "Δ MXN -", "-100.0%", comparativas Presupuestado vs. Real ni
 * alertas; sólo contexto y presupuesto.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
  estado_ingresos: "completo",
  ingresos_documentacion: { evaluada: true, facturas: 0, notas_credito_activas: 0,
    notas_credito_sin_base: 0, notas_credito_sin_valoracion: 0, facturas_sin_valoracion: 0,
    repartos_provisionales: 0, desbordamientos: 0 },
  costos_documentacion: { evaluada: true, conceptos: 0, documentados: 0, sin_documentar: 0 },
  seguros_cobertura: { evaluada: true, vinculados: 0, completos: 0, inconsistentes: 0,
    sin_atribucion: 0, asignacion_indeterminada: 0, sin_valoracion: 0, insuficientes: 0 },
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
  ingresos_documentacion: { ...dataSinActividad.ingresos_documentacion, facturas: 1 },
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

it("audit148 no confirma utilidad de un payload legado sin evaluación de seguros", () => {
  mockUsePnlFinanciero.mockReturnValue({
    data: { ...dataConActividad, estado_costos: "completo", utilidad_mxn: 500,
      seguros_cobertura: undefined },
    isLoading: false, error: null, refetch: vi.fn(),
  });
  render(<TabPnl embarqueId="legacy" />);
  expect(screen.getByText(/La cobertura de seguros no fue evaluada/)).toBeTruthy();
  expect(screen.getByText("Costo observado · provisional")).toBeTruthy();
  expect(screen.getAllByText("No calculable")).toHaveLength(2);
});

it("audit148 conserva provisionalidad cuando un vínculo no cubre la prima", () => {
  mockUsePnlFinanciero.mockReturnValue({
    data: { ...dataConActividad, estado_costos: "incompleto", utilidad_mxn: null,
      seguros_cobertura: { ...dataSinActividad.seguros_cobertura,
        vinculados: 1, inconsistentes: 1, insuficientes: 1 } },
    isLoading: false, error: null, refetch: vi.fn(),
  });
  render(<TabPnl embarqueId="coverage" />);
  expect(screen.getByText(/sin agregar otra prima ni una prima residual/)).toBeTruthy();
  expect(screen.getAllByText("No calculable")).toHaveLength(2);
});


describe("audit129 documentación operativa", () => {
  it("no confirma costos aunque el backend diga completo si queda un concepto sin documentar", () => {
    mockUsePnlFinanciero.mockReturnValue({ data: {
      ...dataConActividad, estado_costos: "completo", utilidad_mxn: 149,
      venta: { real_mxn: 150, presupuestada_mxn: 150, pdte_cobro_mxn: 150 },
      costo: { real_mxn: 1, presupuestado_mxn: 100, pdte_pago_mxn: 0 },
      costos_documentacion: { evaluada: true, conceptos: 1, documentados: 0, sin_documentar: 1 },
    }, isLoading: false, error: null, refetch: vi.fn() });
    render(<TabPnl embarqueId="premium-alone" />);
    expect(screen.getByText(/Hay 1 concepto\(s\) de costo operativo sin asignación positiva/)).toBeTruthy();
    expect(screen.getByText(/El importe facturado no tiene que igualar el presupuesto/)).toBeTruthy();
    expect(screen.getByText("Costo observado · provisional")).toBeTruthy();
    expect(screen.getAllByText("No calculable")).toHaveLength(2);
    expect(screen.queryByText("99.3%")).toBeNull();
  });

  it("expone simultáneamente documentación129 y cobertura148 sin ocultar causas", () => {
    mockUsePnlFinanciero.mockReturnValue({ data: {
      ...dataConActividad, estado_costos: "incompleto", utilidad_mxn: null,
      costos_documentacion: { evaluada: true, conceptos: 2, documentados: 1, sin_documentar: 1 },
      seguros_cobertura: { ...dataSinActividad.seguros_cobertura, vinculados: 1,
        inconsistentes: 1, insuficientes: 1 },
    }, isLoading: false, error: null, refetch: vi.fn() });
    render(<TabPnl embarqueId="two-causes" />);
    expect(screen.getByText(/Hay 1 concepto\(s\) de costo operativo/)).toBeTruthy();
    expect(screen.getByText(/Hay 1 vínculo\(s\) de seguro/)).toBeTruthy();
    expect(screen.getAllByText("Costos incompletos")).toHaveLength(1);
  });

  it("payload148 anterior sin diagnóstico129 queda provisional", () => {
    mockUsePnlFinanciero.mockReturnValue({ data: {
      ...dataConActividad, estado_costos: "completo", utilidad_mxn: 60000,
      costos_documentacion: undefined,
    }, isLoading: false, error: null, refetch: vi.fn() });
    render(<TabPnl embarqueId="prior-backend" />);
    expect(screen.getByText(/La documentación de costos operativos no fue evaluada/)).toBeTruthy();
    expect(screen.getAllByText("No calculable")).toHaveLength(2);
  });

  it("reevalúa tras captura, cancelación y restauración, sin comparar factura y presupuesto", () => {
    const base = { ...dataConActividad, venta: { real_mxn: 150, presupuestada_mxn: 150, pdte_cobro_mxn: 150 },
      costo: { real_mxn: 60, presupuestado_mxn: 100, pdte_pago_mxn: 60 } };
    const setDocumented = (documented: boolean) => mockUsePnlFinanciero.mockReturnValue({ data: {
      ...base, estado_costos: documented ? "completo" : "incompleto", utilidad_mxn: documented ? 90 : null,
      costos_documentacion: { evaluada: true, conceptos: 1, documentados: documented ? 1 : 0,
        sin_documentar: documented ? 0 : 1 },
    }, isLoading: false, error: null, refetch: vi.fn() });
    setDocumented(false);
    const { rerender } = render(<TabPnl embarqueId="document-lifecycle" />);
    expect(screen.getAllByText("No calculable")).toHaveLength(2);
    for (const documented of [true, false, true]) {
      setDocumented(documented);
      rerender(<TabPnl embarqueId="document-lifecycle" />);
      expect(screen.queryAllByText("No calculable")).toHaveLength(documented ? 0 : 2);
      expect(!!screen.queryByText("60.0%")).toBe(documented);
    }
  });
});


describe("audit132 ingresos provisionales", () => {
  const result = (data: unknown) => ({ data, isLoading: false, error: null, refetch: vi.fn() });
  it("exhibe132 junto con documentación129 y cobertura148", () => {
    mockUsePnlFinanciero.mockReturnValue(result({ ...dataConActividad,
      estado_ingresos: "incompleto", estado_costos: "incompleto",
      ingresos_documentacion: { ...dataConActividad.ingresos_documentacion,
        notas_credito_activas: 1, notas_credito_sin_base: 1, repartos_provisionales: 1 },
      costos_documentacion: { evaluada: true, conceptos: 1, documentados: 0, sin_documentar: 1 },
      seguros_cobertura: { ...dataSinActividad.seguros_cobertura, vinculados: 1,
        inconsistentes: 1, insuficientes: 1 },
    }));
    render(<TabPnl embarqueId="three-diagnostics" />);
    expect(screen.getByText("Ingresos incompletos")).toBeTruthy();
    expect(screen.getByText("Costos incompletos")).toBeTruthy();
    expect(screen.getByText("Venta observada · provisional")).toBeTruthy();
    expect(screen.getByText(/no se considera cero ni se usa su monto total como base fiscal/)).toBeTruthy();
    expect(screen.getByText(/reparto proporcional provisional.*no acredita a qué concepto/)).toBeTruthy();
    expect(screen.getByText(/Hay 1 concepto\(s\) de costo operativo/)).toBeTruthy();
    expect(screen.getByText(/Hay 1 vínculo\(s\) de seguro/)).toBeTruthy();
    expect(screen.getAllByText("No calculable")).toHaveLength(2);
    expect(screen.queryByText("Venta facturada menor a presupuestada")).toBeNull();
  });

  it("no calcula utilidad si falta la nueva evaluación de ingresos", () => {
    mockUsePnlFinanciero.mockReturnValue(result({ ...dataConActividad,
      estado_ingresos: undefined, ingresos_documentacion: undefined }));
    render(<TabPnl embarqueId="legacy132" />);
    expect(screen.getByText(/La documentación de ingresos no fue evaluada/)).toBeTruthy();
    expect(screen.getAllByText("No calculable")).toHaveLength(2);
  });

  it("la factura acreditada a cero mantiene comparativas y no afirma ausencia de actividad", () => {
    mockUsePnlFinanciero.mockReturnValue(result({ ...dataSinActividad,
      ingresos_documentacion: { ...dataSinActividad.ingresos_documentacion, facturas: 1, notas_credito_activas: 1 } }));
    render(<TabPnl embarqueId="credited" />);
    expect(screen.queryByText("Sin actividad real todavía")).toBeNull();
    expect(screen.getByText("Ingresos por concepto (Presupuestado vs. Real)")).toBeTruthy();
    expect(screen.getAllByText("No calculable")).toHaveLength(1);
  });

  it("overflow no se redondea a cero ni produce una utilidad falsa", () => {
    mockUsePnlFinanciero.mockReturnValue(result({ ...dataConActividad,
      venta: { ...dataConActividad.venta, real_mxn: null },
      ingresos_documentacion: { ...dataConActividad.ingresos_documentacion, desbordamientos: 1 } }));
    const { container } = render(<TabPnl embarqueId="overflow" />);
    expect(screen.getAllByText("No calculable")).toHaveLength(3);
    expect(screen.getByText(/fuera del rango de cálculo/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("muestra base de NC y valoración desconocidas en el detalle sin fabricar cero", () => {
    mockUsePnlFinanciero.mockReturnValue(result({ ...dataConActividad, estado_ingresos: "incompleto",
      ingresos_documentacion: { ...dataConActividad.ingresos_documentacion,
        notas_credito_activas: 1, notas_credito_sin_valoracion: 1, facturas_sin_valoracion: 1 },
      por_concepto: [{ concepto: "NC sin valoración", presupuestado_mxn: 100, real_mxn: null }],
    }));
    render(<TabPnl embarqueId="unknown-detail" />);
    expect(screen.getByText(/nota\(s\) de crédito de cliente sin valoración utilizable/)).toBeTruthy();
    expect(screen.getByText(/factura\(s\) de venta sin valoración utilizable/)).toBeTruthy();
    expect(screen.getAllByText("No calculable")).toHaveLength(4);
  });

  it("reconsulta NC aplicada y cancelada sin conservar utilidad previa ni incompletitud obsoleta", () => {
    const base = { ...dataConActividad,
      venta: { real_mxn: 150, presupuestada_mxn: 150, pdte_cobro_mxn: 150 },
      costo: { real_mxn: 60, presupuestado_mxn: 100, pdte_pago_mxn: 60 } };
    const setIncomplete = (incomplete: boolean) => mockUsePnlFinanciero.mockReturnValue(result({
      ...base, estado_ingresos: incomplete ? "incompleto" : "completo",
      ingresos_documentacion: { ...base.ingresos_documentacion,
        notas_credito_activas: incomplete ? 1 : 0, notas_credito_sin_base: incomplete ? 1 : 0 },
    }));
    setIncomplete(false);
    const { rerender } = render(<TabPnl embarqueId="nc-lifecycle" />);
    for (const incomplete of [true, false, true]) {
      setIncomplete(incomplete);
      rerender(<TabPnl embarqueId="nc-lifecycle" />);
      expect(screen.queryAllByText("No calculable")).toHaveLength(incomplete ? 2 : 0);
      expect(!!screen.queryByText("60.0%")).toBe(!incomplete);
    }
  });
});


it("audit132 no presenta saldo cero cuando el pendiente de cobro es desconocido", () => {
  mockUsePnlFinanciero.mockReturnValue({ data: { ...dataConActividad,
    venta: { ...dataConActividad.venta, pdte_cobro_mxn: null },
  }, isLoading: false, error: null, refetch: vi.fn() });
  render(<TabPnl embarqueId="unknown-receivable" />);
  const card = screen.getByText("Pendiente de cobro a cliente").parentElement?.parentElement;
  expect(card).toBeTruthy();
  expect(within(card as HTMLElement).getByText("No calculable")).toBeTruthy();
  expect(within(card as HTMLElement).queryByText(/MXN.*0\.00/)).toBeNull();
});


it("audit132 venta negativa conserva actividad y pérdida sin inventar margen positivo", () => {
  mockUsePnlFinanciero.mockReturnValue({ data: { ...dataConActividad,
    venta: { ...dataConActividad.venta, real_mxn: -1350 },
    costo: { ...dataConActividad.costo, real_mxn: 100 },
    ingresos_documentacion: { ...dataConActividad.ingresos_documentacion, notas_credito_activas: 1 },
  }, isLoading: false, error: null, refetch: vi.fn() });
  render(<TabPnl embarqueId="negative-sale" />);
  expect(screen.queryByText("Sin actividad real todavía")).toBeNull();
  expect(screen.getAllByText("No calculable")).toHaveLength(1);
  expect(screen.queryByText("107.4%")).toBeNull();
});

it("audit144 NC con linaje exacto no muestra advertencia proporcional", () => {
  mockUsePnlFinanciero.mockReturnValue({ data: { ...dataConActividad,
    venta: { ...dataConActividad.venta, real_mxn: 40 },
    costo: { ...dataConActividad.costo, real_mxn: 20 },
    ingresos_documentacion: { ...dataConActividad.ingresos_documentacion,
      notas_credito_activas: 1, repartos_provisionales: 0 },
    por_concepto: [
      { concepto: "A seleccionado", presupuestada_mxn: 60, real_mxn: 0 },
      { concepto: "A no seleccionado", presupuestada_mxn: 40, real_mxn: 40 },
    ],
  }, isLoading: false, error: null, refetch: vi.fn() });
  render(<TabPnl embarqueId="exact144" />);
  expect(screen.queryByText("Ingresos incompletos")).toBeNull();
  expect(screen.queryByText(/reparto proporcional provisional/)).toBeNull();
  expect(screen.getByText("Venta real")).toBeTruthy();
  expect(screen.getByText("A seleccionado")).toBeTruthy();
  expect(screen.getByText("A no seleccionado")).toBeTruthy();
});

it("audit144 NC sin linaje advierte incluso con una factura de un embarque", () => {
  mockUsePnlFinanciero.mockReturnValue({ data: { ...dataConActividad,
    estado_ingresos: "incompleto",
    ingresos_documentacion: { ...dataConActividad.ingresos_documentacion,
      facturas: 1, notas_credito_activas: 1, repartos_provisionales: 1 },
  }, isLoading: false, error: null, refetch: vi.fn() });
  render(<TabPnl embarqueId="legacy144" />);
  expect(screen.getByText(/sin linaje verificable en reparto proporcional provisional/)).toBeTruthy();
  expect(screen.queryByText(/factura\(s\) multiembarque/)).toBeNull();
  expect(screen.getAllByText("No calculable")).toHaveLength(2);
});
