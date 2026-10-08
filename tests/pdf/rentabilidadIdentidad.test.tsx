import { describe, expect, it } from "vitest";
import { RentabilidadDocument } from "@/pdf/documents/RentabilidadDocument";
import { inspectPdf } from "./inspectPdf";

describe("PDF real: identidad comercial de Rentabilidad (extensión 13)", () => {
  it("identifica la organización sin configuración fiscal ni fallback genérico", async () => {
    const pdf = await inspectPdf("audit13-rentabilidad-identidad", <RentabilidadDocument
      fechaDesde="2026-10-01" fechaHasta="2026-10-31" organizacionNombre="Comercial Sintética"
      kpis={{ total_venta_usd: 1000, total_costo_usd: 700, total_profit_usd: 300, margen_promedio: 30 }}
      clientes={[{ cliente_nombre: "Cliente sintético", total_embarques: 1, venta_usd: 1000, costo_usd: 700, profit_usd: 300, margen: 30 }]} />);
    expect(pdf.pages).toBe(1);
    for (const text of ["Organización: Comercial Sintética", "Comercial Sintética", "Cliente sintético", "30.0%"]) expect(pdf.text).toContain(text);
    expect(pdf.text).not.toContain("RFC:");
    expect(pdf.text).not.toContain("EMPRESA");
  });
});
