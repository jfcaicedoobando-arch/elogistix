import { describe, it, expect } from "vitest";
import { ReporteCarteraDocument } from "../ReporteCarteraDocument";
import { render } from "@testing-library/react";

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
