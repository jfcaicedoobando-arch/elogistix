import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EstadoCuentaDocument } from "../EstadoCuentaDocument";

describe("estado de cuenta PDF: saldo neto", () => {
  it("rotula Saldo y muestra 58, no el total original de 116", () => {
    const { container } = render(<EstadoCuentaDocument
      cliente={{ nombre: "Cliente sintético", rfc: null }}
      rows={[{ numero: "A3", expediente: "E3", fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-10",
        estado: "Emitida", moneda: "MXN", total: 116, saldo: 58, diasVencido: 0, bucket: "Por vencer" }]}
      totalesPorMoneda={[{ moneda: "MXN", total: 58, buckets: [{ label: "Por vencer", total: 58 }] }]}
    />);
    expect(container).toHaveTextContent("Saldo");
    expect(container).toHaveTextContent("58.00");
    expect(container).not.toHaveTextContent("116.00");
    expect(container).toHaveTextContent("Pendiente MXN");
    expect(container).toHaveTextContent("Por vencer MXN");
  });

  it("identifica el corte parcial y sus subtotales sin sumar cartera fuera del filtro", () => {
    const { container } = render(<EstadoCuentaDocument
      cliente={{ nombre: "Cliente sintético", rfc: null }}
      rows={[{ numero: "A3", expediente: "E3", fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-03",
        estado: "Emitida", moneda: "MXN", total: 116, saldo: 58, diasVencido: 1, bucket: "1-30 días" }]}
      totalesPorMoneda={[{ moneda: "MXN", total: 58, buckets: [{ label: "1-30 días", total: 58 }] }]}
      alcance={{ parcial: true, filtros: ["Antigüedad: 1-30 días", "Moneda: MXN"] }}
    />);
    for (const text of ["Alcance parcial", "Facturas incluidas: 1", "Antigüedad: 1-30 días", "Moneda: MXN",
      "Subtotal Pendiente MXN", "Subtotal del corte", "no representan el saldo global del cliente", "58.00"]) {
      expect(container).toHaveTextContent(text);
    }
    expect(container).not.toHaveTextContent("116.04");
  });
});
