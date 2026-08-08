import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ReporteCarteraDocument } from "../ReporteCarteraDocument";

const totales = [
  { etiqueta: "Por vencer", conteo: "0", mxnHistorico: "0.00", mxnCorte: "0.00", diferencia: "0.00" },
];

describe("ReporteCarteraDocument", () => {
  it("muestra título, fecha de corte y bloques vacíos", () => {
    const { container } = render(
      <ReporteCarteraDocument
        fechaCorte="2023-01-01"
        leyendaTc="TC DOF USD/MXN 19.5000 (publicado el día del corte)"
        bloques={[
          { titulo: "Cuentas por cobrar", totales, facturas: [] },
          { titulo: "Cuentas por pagar", totales, facturas: [] },
        ]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Cartera y antigüedad");
    expect(text).toContain("TC DOF USD/MXN 19.5000");
    expect(text).toContain("Sin saldos pendientes");
  });

  it("incluye el detalle de facturas con su valuación", () => {
    const { container } = render(
      <ReporteCarteraDocument
        fechaCorte="2023-01-15"
        leyendaTc="TC DOF USD/MXN 19.5000 (publicado el día del corte)"
        bloques={[{
          titulo: "Cuentas por cobrar",
          totales,
          facturas: [{
            contraparte: "CLIENTE VENCIDO SA",
            folio: "F-1001",
            expediente: "EXP-1",
            vencimiento: "01/12/2022",
            dias: "45",
            bucket: "31–60 días",
            moneda: "USD",
            saldo: "1500.00",
            mxnHistorico: "27000.00",
            mxnCorte: "29250.00",
            diferencia: "2250.00",
          }],
        }]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("CLIENTE VENCIDO SA");
    expect(text).not.toContain("Sin saldos pendientes");
  });
});
