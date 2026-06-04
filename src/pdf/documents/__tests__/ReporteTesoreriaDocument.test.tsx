import { describe, it, expect, vi } from "vitest";
import { ReporteTesoreriaDocument } from "../ReporteTesoreriaDocument";
import { render } from "@testing-library/react";

vi.mock("@react-pdf/renderer", async () => {
  const actual = await vi.importActual("@react-pdf/renderer");
  return {
    ...actual as any,
    Document: ({ children }: any) => <div data-testid="pdf-doc">{children}</div>,
    Page: ({ children }: any) => <div data-testid="pdf-page">{children}</div>,
    View: ({ children }: any) => <div data-testid="pdf-view">{children}</div>,
    Text: ({ children }: any) => <div data-testid="pdf-text">{children}</div>,
  };
});

const mockResumen = {
  cuentas: [],
  flujo: { por_cobrar_mxn: 0, por_pagar_mxn: 0, flujo_neto_mxn: 0, flujo_neto_usd: 0 },
  top_deudores: [],
  top_acreedores: [],
} as any;

describe("ReporteTesoreriaDocument", () => {
  it("debe renderizar sin errores con resumen mínimo", () => {
    const { getByTestId } = render(
      <ReporteTesoreriaDocument fechaCorte="2023-01-01" resumen={mockResumen} />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });

  it("debe renderizar con cuentas bancarias", () => {
    const resumen = {
      ...mockResumen,
      cuentas: [{ id: "1", alias: "A1", banco: "B1", moneda: "MXN", saldo: 1000 }]
    };
    const { getByTestId } = render(
      <ReporteTesoreriaDocument fechaCorte="2023-01-01" resumen={resumen} />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });
});
