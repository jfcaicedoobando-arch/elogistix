import { describe, it, expect } from "vitest";
import { ReporteTesoreriaDocument } from "../ReporteTesoreriaDocument";
import { render } from "@testing-library/react";

const mockResumen = {
  cuentas: [],
  flujo: { por_cobrar_mxn: 0, por_pagar_mxn: 0, flujo_neto_mxn: 0, flujo_neto_usd: 0 },
  top_deudores: [],
  top_acreedores: [],
} as any;

describe("ReporteTesoreriaDocument", () => {
  it("muestra título y leyendas para listas vacías", () => {
    const { container } = render(
      <ReporteTesoreriaDocument fechaCorte="2023-01-01" resumen={mockResumen} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Resumen de Tesorería");
    expect(text).toContain("Sin cuentas bancarias configuradas");
    expect(text).toContain("Sin deudores vencidos");
    expect(text).toContain("Sin vencimientos próximos");
    expect(text).toContain("Flujo esperado 30 días");
  });

  it("incluye alias de cuentas bancarias cuando hay datos", () => {
    const resumen = {
      ...mockResumen,
      cuentas: [{ id: "1", alias: "Operativa MXN", banco: "BBVA", moneda: "MXN", saldo: 1234567 }],
    };
    const { container } = render(
      <ReporteTesoreriaDocument fechaCorte="2023-01-01" resumen={resumen} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Operativa MXN");
    expect(text).toContain("BBVA");
    expect(text).not.toContain("Sin cuentas bancarias");
  });
});
