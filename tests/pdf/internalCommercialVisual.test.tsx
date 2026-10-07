import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";
import { TarifarioDocument } from "@/pdf/documents/TarifarioDocument";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";
import { ProformaConsolidadaDocument } from "@/pdf/documents/ProformaConsolidadaDocument";
import { EstadoCuentaDocument } from "@/pdf/documents/EstadoCuentaDocument";
import { inspectPdf } from "./inspectPdf";
import { concepto, cotizacion, embarque, proforma } from "./fixtures";

const emisor = { razonSocial: "Logística de ejemplo", subtitulo: "Muestra visual · Datos sintéticos", contacto: "operaciones@example.test" };
const nombreUnicode = "Álvarez, Peña & Müller · Ω";
const cot = { ...cotizacion, operador: "Equipo comercial", cliente_nombre: nombreUnicode };

function assertContent(text: string, expected: string[]) {
  for (const value of expected) expect(text).toContain(value);
  expect(text).not.toContain("undefined");
  expect(text).not.toContain("NaN");
}

describe("diseño comercial: renderer real y datos sintéticos", () => {
  it("cotización con las dos monedas, Unicode y totales", async () => {
    const pdf = await inspectPdf("diseno-cotizacion", <CotizacionDocument cotizacion={cot} emisor={emisor} />);
    assertContent(pdf.text, [nombreUnicode, "Cotización", "USD 1,800.00", "MXN 1,160.00", "No objeto", "16%", "Página 1 de"]);
  });
  it("tarifario con textos largos, rutas y monedas", async () => {
    const tarifas = Array.from({ length: 24 }, (_, i) => ({ id: `tarifa-${i}`, modo: "Terrestre", modalidad_equipo: "Porta Contenedor", origen: "Manzanillo, Colima", punto_intermedio: "Guadalajara, Jalisco", destino: "Monterrey, Nuevo León", unidad_medida: "Viaje", precio: 1500 + i, moneda: i % 2 ? "MXN" : "USD", notas: `Tarifa ${i + 1}: servicio de traslado con coordinación y revisión documental.` }));
    const pdf = await inspectPdf("diseno-tarifario-largo", <TarifarioDocument cotizacion={{ ...cot, tarifas_informativas: tarifas, vigencia_desde: "2026-10-01", vigencia_hasta: "2026-10-31" }} emisor={emisor} />);
    expect(pdf.pages).toBeGreaterThan(1);
    assertContent(pdf.text, ["Tarifario Informativo", "Tarifa 24", "Guadalajara", "USD 1,500.00", "MXN 1,523.00"]);
  });
  it("proforma individual conserva total y última fila en multipágina", async () => {
    const conceptos = Array.from({ length: 30 }, (_, i) => concepto(i + 1, { descripcion: `Servicio ${i + 1}: revisión documental y coordinación de mercancía frágil desde Manzanillo a Monterrey.`, total: 1000 }));
    const pdf = await inspectPdf("diseno-proforma-larga", <ProformaDocument proforma={{ ...proforma, cliente_nombre: nombreUnicode, subtotal_usd: 0, total_usd: 0, subtotal_mxn: 30000, iva_mxn: 4800, total_mxn: 34800 }} embarque={embarque} conceptos={conceptos} emisor={emisor} />);
    expect(pdf.pages).toBeGreaterThan(1);
    assertContent(pdf.text, [nombreUnicode, "Servicio 30", "MXN 34,800.00", "Documento sin validez fiscal", "Página 1 de"]);
    expect(pdf.text.match(/\bServicio \d+:/g)).toEqual(Array.from({ length: 30 }, (_, i) => `Servicio ${i + 1}:`));
    expect(pdf.rawText).not.toMatch(/Manzanil-\s*\nlo|documen-\s*\ntal|coor-\s*\ndinación|mer-\s*\ncancía/);
    expect(pdf.rawText.match(/Proforma - PRO-QA-2026-001/g)).toHaveLength(pdf.pages - 1);
  });
  it("proforma consolidada mantiene grupos y total almacenado", async () => {
    const conceptosConsolidados: ComponentProps<typeof ProformaConsolidadaDocument>["conceptosConsolidados"] = Array.from({ length: 24 }, (_, i) => ({
      id: `consolidado-${i}`, organization_id: "synthetic-org", proforma_id: "synthetic-proforma", embarque_id: null,
      created_at: "2026-10-01", updated_at: null, deleted_at: null, deleted_by: null,
      descripcion: `Concepto consolidado ${i + 1}: coordinación de embarque`, cantidad: 1, precio_unitario: 1000, iva: 160, total: 1160,
      moneda: "MXN", aplica_iva: true, tasa_iva_aplicada: 0.16, tipo_iva: "gravado_16", contenedor: i < 12 ? "DEMO0000001" : "DEMO0000002", tipo_contenedor: "40HC",
    }));
    const pdf = await inspectPdf("diseno-proforma-consolidada", <ProformaConsolidadaDocument proforma={{ ...proforma, subtotal_mxn: 24000, iva_mxn: 3840, total_mxn: 27840, subtotal_usd: 0, total_usd: 0 }} embarque={embarque} conceptosConsolidados={conceptosConsolidados} emisor={emisor} />);
    expect(pdf.pages).toBeGreaterThan(1);
    assertContent(pdf.text, ["Proforma Consolidada", "Concepto consolidado 24", "DEMO0000001", "DEMO0000002", "27,840.00"]);
  });
  it("estado de cuenta multipágina mantiene corte, saldo neto y divisas", async () => {
    const rows = Array.from({ length: 45 }, (_, i) => ({ numero: `FAC-DEMO-${i + 1}`, expediente: `EXP-LARGO-2026-${i + 1}`, fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-05", estado: "Emitida", moneda: "MXN", total: 116, saldo: 58, diasVencido: 1, bucket: "1-30 días" }));
    const pdf = await inspectPdf("diseno-estado-cuenta", <EstadoCuentaDocument cliente={{ nombre: nombreUnicode, rfc: null }} rows={rows} totalesPorMoneda={[{ moneda: "MXN", total: 2610, buckets: [{ label: "1-30 días", total: 2610 }] }]} alcance={{ parcial: true, filtros: ["Moneda: MXN", "Sólo con saldo"] }} emisor={emisor} />);
    expect(pdf.pages).toBe(3);
    expect(pdf.text.match(/\bFAC-DEMO-\d+\b/g)).toEqual(Array.from({ length: 45 }, (_, i) => `FAC-DEMO-${i + 1}`));
    assertContent(pdf.text, [nombreUnicode, "FAC-DEMO-45", "Alcance parcial", "Moneda: MXN", "2,610.00", "58.00"]);
    expect(pdf.text).not.toContain("116.00");
  });
  it("vacíos y emisor sin logo no inventan datos ni importes", async () => {
    const pdf = await inspectPdf("diseno-proforma-vacia", <ProformaDocument proforma={{ ...proforma, subtotal_usd: 0, total_usd: 0, subtotal_mxn: 0, iva_mxn: 0, total_mxn: 0 }} embarque={embarque} conceptos={[]} />);
    assertContent(pdf.text, ["Documento interno", "Sin conceptos para mostrar.", "Proforma"]);
    expect(pdf.text).not.toContain("RFC:");
    expect(pdf.text).not.toContain("Subtotal");
  });
  it("notas largas de cotización fluyen sin perder el final", async () => {
    const notes = Array.from({ length: 30 }, (_, i) => `Nota ${i + 1}: ${"Condición comercial de ejemplo sin información fiscal. ".repeat(8)}`).join("\n\n");
    const pdf = await inspectPdf("diseno-cotizacion-notas-largas", <CotizacionDocument cotizacion={{ ...cot, notas: notes }} emisor={emisor} />);
    expect(pdf.pages).toBeGreaterThan(2);
    assertContent(pdf.text, ["Nota 1:", "Nota 30:", "1,800.00", "1,160.00"]);
  });
  it("conserva identificadores largos en descripciones sin guiones añadidos", async () => {
    const identificador = "CONTENEDOR1234567890".repeat(6);
    const pdf = await inspectPdf("diseno-proforma-identificador-largo", <ProformaDocument
      proforma={{ ...proforma, subtotal_usd: 0, total_usd: 0 }} embarque={embarque}
      conceptos={[concepto(1, { descripcion: `Referencia ${identificador}` })]} emisor={emisor} />);
    expect(pdf.rawText.replace(/\s/g, "")).toContain(identificador);
    expect(pdf.text).toContain("MXN 1,160.00");
  });

});
