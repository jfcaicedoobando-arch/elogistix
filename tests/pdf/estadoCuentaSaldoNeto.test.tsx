import { describe, expect, it } from "vitest";
import { EstadoCuentaDocument } from "@/pdf/documents/EstadoCuentaDocument";
import { inspectPdf } from "./inspectPdf";

describe("real PDF: saldo neto del cliente", () => {
  it("imprime 58 en pendiente, fila y antigüedad tras NC de 58 sobre total 116", async () => {
    const doc = await inspectPdf("estado-cuenta-saldo-neto", <EstadoCuentaDocument
      cliente={{ nombre: "Cliente sintético QA48", rfc: null }}
      rows={[{ numero: "A3-QA", expediente: "E3", fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-10",
        estado: "Emitida", moneda: "MXN", total: 116, saldo: 58, diasVencido: 0, bucket: "Por vencer" }]}
      totalesPorMoneda={[{ moneda: "MXN", total: 58, buckets: [{ label: "Por vencer", total: 58 }] }]}
    />);
    expect(doc.pages).toBe(1);
    for (const text of ["A3-QA", "SALDO", "58.00", "PENDIENTE MXN", "POR VENCER MXN"]) expect(doc.text).toContain(text);
    expect(doc.text).not.toContain("116.00");
  });

  it("imprime alcance parcial, filtro y subtotal 58 en una página", async () => {
    const doc = await inspectPdf("estado-cuenta-alcance-76", <EstadoCuentaDocument
      cliente={{ nombre: "Cliente sintético QA76", rfc: null }}
      rows={[{ numero: "A3-QA", expediente: "E3", fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-03",
        estado: "Emitida", moneda: "MXN", total: 116, saldo: 58, diasVencido: 1, bucket: "1-30 días" }]}
      totalesPorMoneda={[{ moneda: "MXN", total: 58, buckets: [{ label: "1-30 días", total: 58 }] }]}
      alcance={{ parcial: true, filtros: ["Emisión: 01/09/2026 a 04/10/2026", "Moneda: MXN", "Sólo con saldo", "Antigüedad: 1-30 días"] }}
    />);
    expect(doc.pages).toBe(1);
    for (const text of ["Alcance parcial", "Facturas incluidas: 1", "Antigüedad: 1-30 días", "Moneda: MXN",
      "SUBTOTAL PENDIENTE MXN", "Subtotal del corte", "no representan el saldo global", "58.00"]) expect(doc.text).toContain(text);
    expect(doc.text).not.toContain("116.04");
  });
});
