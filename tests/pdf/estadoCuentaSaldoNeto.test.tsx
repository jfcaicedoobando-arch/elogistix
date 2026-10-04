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
});
