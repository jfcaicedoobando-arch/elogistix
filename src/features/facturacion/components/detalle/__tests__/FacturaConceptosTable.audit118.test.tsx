/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FacturaConceptosTable } from "../FacturaConceptosTable";
import { formatCurrency } from "@/lib/formatters";

const live = { descripcion: "Servicio", cantidad: 1, precio_unitario: 100, total: 100,
  tipo_iva: "gravado_16" as const, tasa_ret_isr: 0.1, tasa_ret_iva: 0.04, monto_ret_isr: 10, monto_ret_iva: 4 };

describe("AUD118: retenciones del documento emitido", () => {
  it("explica ambas tasas/importes por línea y resta ambas retenciones en totales", () => {
    render(<FacturaConceptosTable snapshot={null} moneda="MXN" conceptos={[live]} subtotal={100} iva={16} total={102} retIsr={10} retIva={4} />);
    expect(screen.getAllByText(/Ret\. ISR 10%:/)).toHaveLength(2);
    expect(screen.getAllByText(/Ret\. IVA 4%:/)).toHaveLength(2);
    expect(screen.getByText("Retención ISR")).toBeInTheDocument();
    expect(screen.getByText("Retención IVA")).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(-10, "MXN"))).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(-4, "MXN"))).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(102, "MXN"))).toBeInTheDocument();
  });
  it("fallback al snapshot conserva retenciones sin confundir traslado IVA", () => {
    render(<FacturaConceptosTable moneda="USD" subtotal={100} iva={16} total={102} snapshot={{ conceptos: [{
      descripcion: "Servicio", cantidad: 1, precio_unitario: 100, importe: 100,
      product: { taxes: [{ type: "IVA", rate: 0.16 }, { type: "ISR", rate: 0.1, withholding: true }, { type: "IVA", rate: 0.04, withholding: true }] },
    }] }} />);
    expect(screen.getAllByText(/Ret\. ISR 10%:/)).toHaveLength(2);
    expect(screen.getAllByText(/Ret\. IVA 4%:/)).toHaveLength(2);
    expect(screen.getAllByText("16%")).toHaveLength(2);
    expect(screen.getByText(formatCurrency(-10, "USD"))).toBeInTheDocument();
  });
  it("sin retenciones no inventa descuentos", () => {
    render(<FacturaConceptosTable moneda="MXN" snapshot={null} conceptos={[{ ...live, tasa_ret_isr: 0, tasa_ret_iva: 0, monto_ret_isr: 0, monto_ret_iva: 0 }]} subtotal={100} iva={16} total={116} />);
    expect(screen.queryByText("Retención ISR")).not.toBeInTheDocument();
    expect(screen.queryByText("Retención IVA")).not.toBeInTheDocument();
  });
});
