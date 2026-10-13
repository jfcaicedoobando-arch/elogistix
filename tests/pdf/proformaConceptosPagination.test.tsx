import { describe, expect, it } from "vitest";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";
import type { EmbarqueLite } from "@/pdf/documents/proformaShared";
import { inspectPdf } from "./inspectPdf";
import { pdfWordBounds } from "./inspectPdfLayout";
import { concepto, embarque, proforma } from "./fixtures";

// The three fictional concepts from PRO-2026-0030 reproduce the old 2+1 split.
const input = { ...proforma, numero: "PRO-2026-0030", expediente: "ELNAC00030",
  fecha_emision: "2026-10-12", operador: "admin@chino.com", dias_credito: 30, bl_master: null,
  cliente_nombre: "TEXTILES PUENTE ÁMBAR SA DE CV [AUD2-MOCK-20261012-C06]",
  notas: "AUD2-MOCK-20261012-FIN-PRO-07 | DATOS FICTICIOS DE AUDITORÍA. No representa servicio, cobro, pago o CFDI real. Sin envío externo.",
  subtotal_usd: 0, iva_usd: 0, total_usd: 0, subtotal_mxn: 49700, iva_mxn: 7952, total_mxn: 57652 };
const shipment: EmbarqueLite = { ...embarque, modo: "Terrestre", tipo: "Nacional", incoterm: "N/A",
  puerto_origen: null, puerto_destino: null, aeropuerto_origen: null, aeropuerto_destino: null,
  ciudad_origen: "León", ciudad_destino: "Monterrey", bl_house: null, contenedores: [],
  descripcion_mercancia: "Rollos textiles sobre tarima, carga seca" };
const customer = { nombre: input.cliente_nombre, rfc: "",
  direccion: "DOMICILIO FICTICIO DE PRUEBAS C06; no entrega física", ciudad: "León", estado: "Guanajuato", cp: "37000" };
const issuer = { organizacionNombre: "Chino Cochino" };
const rows = [
  concepto(1, { descripcion: "Flete terrestre dedicado [AUD2-MOCK-20261012-Q06-K01]", precio_unitario: 45000 }),
  concepto(2, { descripcion: "Maniobras de carga y descarga [AUD2-MOCK-20261012-Q06-K02]", precio_unitario: 3500 }),
  concepto(3, { descripcion: "Coordinación operativa [AUD2-MOCK-20261012-Q06-K03]", precio_unitario: 1200 }),
];

describe("PDF real: conceptos empiezan en la segunda hoja", () => {
  it("conserva los tres conceptos de PRO-2026-0030 juntos con notas y totales", async () => {
    const name = "PRO-2026-0030-corregida";
    const before = JSON.stringify({ input, shipment, customer, rows });
    const pdf = await inspectPdf(name, <ProformaDocument proforma={input} embarque={shipment} cliente={customer} conceptos={rows} emisor={issuer} />);
    expect(pdf.pages).toBe(2);
    const words = pdfWordBounds(name);
    for (const marker of ["Conceptos", "Flete", "Maniobras", "Coordinación", "Notas", "Subtotal"]) {
      expect(words.filter(w => w.text === marker).map(w => w.page)).toEqual([1]);
    }
    for (const text of ["Documento sin validez fiscal", "30 días", "MXN 49,700.00", "MXN 7,952.00", "MXN 57,652.00", input.notas]) expect(pdf.text).toContain(text);
    expect(JSON.stringify({ input, shipment, customer, rows })).toBe(before);
    for (const word of words) {
      expect(word.xMin).toBeGreaterThanOrEqual(35.5);
      expect(word.xMax).toBeLessThanOrEqual(576.5);
      expect(word.yMax).toBeLessThanOrEqual(773);
    }
  });

  it("listas largas continúan después de la segunda hoja sin partir filas", async () => {
    const name = "proforma-conceptos-multipagina";
    const many = Array.from({ length: 55 }, (_, index) => concepto(index + 1, {
      descripcion: `InicioFila${index + 1} coordinación logística y entrega de mercancía\nFinFila${index + 1}`,
    }));
    const pdf = await inspectPdf(name, <ProformaDocument proforma={input} embarque={shipment} conceptos={many} emisor={issuer} />);
    expect(pdf.pages).toBeGreaterThan(2);
    const words = pdfWordBounds(name);
    for (let index = 1; index <= many.length; index++) {
      const starts = words.filter(w => w.text === `InicioFila${index}`);
      const ends = words.filter(w => w.text === `FinFila${index}`);
      expect(starts).toHaveLength(1);
      expect(ends).toHaveLength(1);
      expect(starts[0].page).toBeGreaterThanOrEqual(1);
      expect(starts[0].page).toBe(ends[0].page);
      expect(ends[0].yMax).toBeLessThanOrEqual(742);
    }
  });
});
