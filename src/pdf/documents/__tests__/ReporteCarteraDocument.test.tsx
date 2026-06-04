import { describe, it, expect, vi } from "vitest";
import { ReporteCarteraDocument } from "../ReporteCarteraDocument";
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

describe("ReporteCarteraDocument", () => {
  it("debe renderizar sin errores con datos vacíos", () => {
    const { getByTestId } = render(
      <ReporteCarteraDocument fechaCorte="2023-01-01" cxc={[]} cxp={[]} />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });

  it("debe renderizar con facturas", () => {
    const cxc = [{ cliente_nombre: "C1", numero: "F1", saldo: 100, moneda: "USD", dias_vencido: 5 }] as any;
    const { getByTestId } = render(
      <ReporteCarteraDocument fechaCorte="2023-01-01" cxc={cxc} cxp={[]} />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });
});
