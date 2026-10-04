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
});
