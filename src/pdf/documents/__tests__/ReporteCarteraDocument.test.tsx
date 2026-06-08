import { describe, it, expect } from "vitest";
import { ReporteCarteraDocument } from "../ReporteCarteraDocument";
import { render } from "@testing-library/react";

describe("ReporteCarteraDocument", () => {
  it("muestra título, fecha de corte y leyendas vacías", () => {
    const { container } = render(
      <ReporteCarteraDocument fechaCorte="2023-01-01" cxc={[]} cxp={[]} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Cartera CxC + CxP");
    expect(text).toContain("Sin cartera vencida");
    expect(text).toContain("Sin facturas por pagar");
  });

  it("incluye nombre de cliente con saldo vencido en CxC", () => {
    const cxc = [{
      cliente_nombre: "Cliente Vencido SA",
      numero: "F-1001",
      saldo: 1500,
      moneda: "USD",
      dias_vencido: 45,
      fecha_emision: "2022-11-01",
      fecha_vencimiento: "2022-12-01",
    }] as any;
    const { container } = render(
      <ReporteCarteraDocument fechaCorte="2023-01-15" cxc={cxc} cxp={[]} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Cliente Vencido SA");
    expect(text).not.toContain("Sin cartera vencida");
  });
});
