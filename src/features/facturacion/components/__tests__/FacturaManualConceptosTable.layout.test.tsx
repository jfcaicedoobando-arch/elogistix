import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FacturaManualConceptosTable } from "../FacturaManualConceptosTable";

vi.mock("@/features/configuracion", () => ({ useIvaFronteraHabilitada: () => false }));

describe("FacturaManualConceptosTable · importe visible", () => {
  it("reserva una celda amplia para el importe y no aplica truncate", () => {
    render(<FacturaManualConceptosTable
      conceptos={[{ descripcion: "Flete", cantidad: 1, precio_unitario: 1234567.89, clave_sat: "78101800", tipo_iva: "gravado_16" }]}
      moneda="MXN" onChange={vi.fn()}
    />);
    const importe = screen.getByText(/1,234,567\.89/);
    expect(importe).toHaveClass("whitespace-nowrap");
    expect(importe).not.toHaveClass("truncate");
    expect(importe.closest(".sm\\:col-span-4")).toBeTruthy();
  });
});
