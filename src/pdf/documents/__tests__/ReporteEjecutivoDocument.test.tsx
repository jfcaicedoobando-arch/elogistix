import { describe, it, expect } from "vitest";
import { ReporteEjecutivoDocument } from "../ReporteEjecutivoDocument";
import { render } from "@testing-library/react";

const mockSnapshot = {
  periodo: "2023-01",
  generadoEn: "2023-01-01T10:00:00Z",
  kpis: { ingresos_mxn: 0, utilidad_mxn: 0, margen_pct: 0, saldo_bancos_mxn: 0 },
  tesoreria: { cuentas: [] },
  topDeudores: [],
  topAcreedores: [],
  alertas: [],
} as any;

describe("ReporteEjecutivoDocument", () => {
  it("debe renderizar sin errores con snapshot mínimo", () => {
    const { getByTestId } = render(<ReporteEjecutivoDocument snapshot={mockSnapshot} />);
    expect(getByTestId("pdf-doc")).toBeDefined();
  });

  it("debe renderizar con datos en tablas", () => {
    const snapshot = {
      ...mockSnapshot,
      topDeudores: [{ nombre: "D1", saldo: 100, moneda: "USD" }]
    };
    const { getByTestId } = render(<ReporteEjecutivoDocument snapshot={snapshot} />);
    expect(getByTestId("pdf-doc")).toBeDefined();
  });
});
