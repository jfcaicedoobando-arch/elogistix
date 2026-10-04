import { describe, expect, it } from "vitest";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";
import { ReporteTesoreriaDocument } from "@/pdf/documents/ReporteTesoreriaDocument";
import { calcularResumenTesoreria } from "@/features/tesoreria/domain/resumen";
import { inspectPdf } from "./inspectPdf";
import { concepto, cotizacion, embarque, emisor, proforma } from "./fixtures";

describe("real PDF renderer (on demand, without the normal Vitest stub)", () => {
  it("generates a readable quote with both currencies and tax treatments", async () => {
    const doc = await inspectPdf("cotizacion", <CotizacionDocument cotizacion={cotizacion} emisor={emisor} />);
    expect(doc.pages).toBe(2); // Visually reviewed current quote layout.
    for (const text of ["COT-QA-2026-001", "Refacciones Industriales", "Ningbo", "Manzanillo", "1,800.00", "1,160.00", "No objeto", "16%"]) expect(doc.text).toContain(text);
  });
  it("generates a mixed-tax proforma, preserving amounts and labels", async () => {
    const conceptos = [concepto(1), concepto(2, { descripcion: "Flete marítimo Ningbo-Manzanillo", moneda: "USD", precio_unitario: 1800, total: 1800, aplica_iva: false, tasa_iva_aplicada: 0, tipo_iva: "no_objeto" })];
    const doc = await inspectPdf("proforma", <ProformaDocument proforma={proforma} embarque={embarque} conceptos={conceptos} emisor={emisor} />);
    expect(doc.pages).toBe(2); // Both currency sections and totals are retained.
    for (const text of ["PRO-QA-2026-001", "No objeto", "16%", "1,800.00", "1,160.00"]) expect(doc.text).toContain(text);
  });
  it("paginates long descriptions and retains the last item, totals and footer", async () => {
    const conceptos = Array.from({ length: 60 }, (_, index) => concepto(index + 1, {
      descripcion: `Servicio ${String(index + 1).padStart(2, "0")} - Traslado y revisión documental de refacciones industriales desde Manzanillo a Monterrey, Nuevo León.`,
    }));
    const long = { ...proforma, subtotal_usd: 0, total_usd: 0, subtotal_mxn: 60_000, iva_mxn: 9600, total_mxn: 69_600 };
    const doc = await inspectPdf("proforma-larga", <ProformaDocument proforma={long} embarque={embarque} conceptos={conceptos} emisor={emisor} />);
    expect(doc.pages).toBeGreaterThan(1);
    for (const text of ["Servicio 01", "Servicio 60", "69,600.00", "LOGÍSTICA REGIOMONTANA QA"]) expect(doc.text).toContain(text);
  });
  it("generates the actual treasury report, with MXN and USD bank balances", async () => {
    const resumen = calcularResumenTesoreria({
      cuentas: [{ id: "mxn-qa", alias: "Operación Monterrey", banco: "BBVA", moneda: "MXN", saldo: 125_000 },
        { id: "usd-qa", alias: "Fletes internacionales", banco: "BBVA", moneda: "USD", saldo: 8000 }],
      cobranza: [], cxp: [], hoy: new Date("2026-10-03T12:00:00"), tipoCambioUsd: 18,
    });
    const doc = await inspectPdf("tesoreria", <ReporteTesoreriaDocument fechaCorte="2026-10-03" resumen={resumen} emisor={emisor} />);
    expect(doc.pages).toBe(1);
    for (const text of ["Resumen de Tesorería", "Operación Monterrey", "125,000.00", "8,000.00", "Sin deudores vencidos"]) expect(doc.text).toContain(text);
  });
});
