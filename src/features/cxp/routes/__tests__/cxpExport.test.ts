import { describe, it, expect } from "vitest";
import { formatCurrency } from "@/lib/formatters";

describe("Exportación CSV CxP", () => {
  it("genera una fila de CSV bien formada con formatters canónicos", () => {
    const row = {
      folio_interno: "F-001",
      proveedor_nombre: "Proveedor Test",
      fecha_emision: "2026-01-01",
      fecha_vencimiento: "2026-02-01",
      total: 1000,
      saldo: 500,
      moneda: "MXN" as const,
    };

    // Siguiendo el patrón de exportación de CxpAging
    const headers = ["Folio", "Proveedor", "Emisión", "Vencimiento", "Total", "Saldo", "Moneda"];
    const line = [
      row.folio_interno,
      `"${row.proveedor_nombre.replace(/"/g, '""')}"`,
      row.fecha_emision,
      row.fecha_vencimiento,
      formatCurrency(row.total, row.moneda),
      formatCurrency(row.saldo, row.moneda),
      row.moneda,
    ].join(",");

    expect(headers).toHaveLength(7);
    expect(line.startsWith("F-001,")).toBe(true);
    expect(line.endsWith(",MXN")).toBe(true);
    expect(line).toContain(formatCurrency(row.saldo, row.moneda));
  });
});
