import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ReporteEjecutivoDocument } from "../ReporteEjecutivoDocument";
import type { SnapshotEjecutivo } from "@/services/dashboard-ejecutivo";

const mockSnapshot = {
  periodo: "2023-01",
  generadoEn: "2023-01-01T10:00:00Z",
  kpis: {
    ingresos_mxn: 0,
    ingresos_delta_pct: 0,
    utilidad_mxn: 0,
    margen_pct: 0,
    saldo_bancos_mxn: 0,
    cartera_vencida_mxn: 0,
    cartera_vencida_count: 0,
    cxp_7dias_mxn: 0,
    cumplimiento_presupuesto_pct: 0,
  },
  eerrPeriodo: {} as SnapshotEjecutivo["eerrPeriodo"],
  eerr12m: [],
  tesoreria: { cuentas: [] } as unknown as SnapshotEjecutivo["tesoreria"],
  flujo: {} as SnapshotEjecutivo["flujo"],
  presupuesto: {} as SnapshotEjecutivo["presupuesto"],
  topDeudores: [],
  topAcreedores: [],
  alertas: [],
} satisfies SnapshotEjecutivo;

afterEach(() => { cleanup(); });

describe("ReporteEjecutivoDocument", () => {
  it("debe renderizar sin errores con snapshot mínimo", () => {
    const { getByTestId } = render(<ReporteEjecutivoDocument snapshot={mockSnapshot} />);
    expect(getByTestId("pdf-doc")).toBeDefined();
  });

  it("debe renderizar con datos en tablas", () => {
    const deudor: SnapshotEjecutivo["topDeudores"][number] = {
      nombre: "D1",
      saldo: 100,
      moneda: "USD",
    };
    const snapshot: SnapshotEjecutivo = {
      ...mockSnapshot,
      topDeudores: [deudor],
    };
    const { getByTestId } = render(<ReporteEjecutivoDocument snapshot={snapshot} />);
    expect(getByTestId("pdf-doc")).toBeDefined();
  });
});
