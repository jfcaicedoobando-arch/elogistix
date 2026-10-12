import { describe, expect, it } from "vitest";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";
import { splitNotas } from "@/pdf/components/notasSplit";
import { inspectPdf } from "./inspectPdf";
import { pdfWordBounds } from "./inspectPdfLayout";
import { concepto, embarque, proforma } from "./fixtures";

// Poppler XML escapes URL query separators; PyMuPDF returns literal characters.
const decode = (text: string) => text.replace(/&(amp|lt|gt|quot|apos);/g,
  (_, key: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[key]!);
const logical = (text: string) => decode(text).normalize("NFD").replace(/\s/gu, "");
const cases = [
  ["w40", "W".repeat(40)],
  ["url", "https://example.test/" + "ruta_continua-".repeat(6) + "?folio=PRO20260012&lang=es%2DMX"],
  ["cirilico", "ЖЮЯ".repeat(20)],
  ["acentos", "ÁÉÍÓÚÑÜ".repeat(10)],
  ["combinantes", "e\u0301Ñ".repeat(30)],
  ["corte-grapheme", "x".repeat(179) + "e\u0301" + "y".repeat(40)],
  ["w220", "W".repeat(220)],
] as const;

function assertNotesGeometry(name: string, notes: string) {
  const words = pdfWordBounds(name);
  const title = words.find(w => w.text === "Notas");
  expect(title).toBeDefined();
  const labels = words.filter(w => w.page === title!.page && w.xMin >= 279 && ["Subtotal", "IVA", "Total"].includes(w.text));
  const cardTop = Math.min(...labels.map(w => w.yMin)) - 6;
  const cardBottom = Math.max(...labels.map(w => w.yMax)) + 12;
  const chars = new Set(Array.from(logical(notes)));
  const body = words.filter(w => (w.page > title!.page || (w.page === title!.page && w.yMin > title!.yMax))
    && w.yMax <= 742 && Array.from(logical(w.text)).every(char => chars.has(char))
    && !(w.page === title!.page && w.xMin >= 279 && w.yMin >= cardTop && w.yMin <= cardBottom));
  expect(body.length).toBeGreaterThan(0);
  expect(body.map(w => logical(w.text)).join("")).toBe(logical(notes));

  const openingLength = logical(splitNotas(notes).head).length;
  let offset = 0;
  for (const word of body) {
    const opening = offset < openingLength;
    expect(word.xMin, JSON.stringify(word)).toBeGreaterThanOrEqual(opening ? 44.95 : 48.95);
    expect(word.xMax, JSON.stringify(word)).toBeLessThanOrEqual(opening ? 261.05 : 566.05);
    // The actual Inter glyph boxes confirm notes keep their inherited 10pt face.
    expect(word.yMax - word.yMin).toBeGreaterThan(10);
    expect(word.yMax - word.yMin).toBeLessThan(13);
    offset += logical(word.text).length;
  }
  const totals = words.filter(w => w.page === title!.page && w.xMin >= 279 && w.yMax <= 742 && !body.includes(w));
  expect(totals.find(w => w.text === "Subtotal")).toBeDefined();
  for (const note of body) for (const total of totals) {
    if (note.page !== total.page) continue;
    const overlapX = Math.min(note.xMax, total.xMax) - Math.max(note.xMin, total.xMin);
    const overlapY = Math.min(note.yMax, total.yMax) - Math.max(note.yMin, total.yMin);
    expect(overlapX > 0.05 && overlapY > 0.05, JSON.stringify({ note, total })).toBe(false);
  }
  return body;
}

describe("PDF real: notas sin espacios no invaden la tarjeta de totales", () => {
  for (const [label, notes] of cases) {
    it(`conserva texto y geometría: ${label}`, async () => {
      const name = "proforma-notas-token-" + label;
      const input = { ...proforma, notas: notes };
      const before = JSON.stringify(input);
      const pdf = await inspectPdf(name, <ProformaDocument proforma={input} embarque={embarque} conceptos={[concepto(1)]} />);
      expect(pdf.text).toContain("MXN 1,160.00");
      expect(JSON.stringify(input)).toBe(before);
      const body = assertNotesGeometry(name, notes);
      if (label === "w40") {
        expect(pdf.pages).toBe(1);
        expect(new Set(body.map(w => w.yMin.toFixed(2))).size).toBeGreaterThan(1);
      }
      if (label === "corte-grapheme") {
        const parts = splitNotas(notes);
        expect(parts.head.endsWith("e")).toBe(false);
        expect(parts.rest.startsWith("e\u0301")).toBe(true);
      }
    });
  }

  it("conserva la división segura junto a las dos monedas", async () => {
    const name = "proforma-notas-token-multimoneda";
    const notes = "W".repeat(40);
    const pdf = await inspectPdf(name, <ProformaDocument proforma={{ ...proforma, notas: notes }} embarque={embarque}
      conceptos={[concepto(1), concepto(2, { moneda: "USD" })]} />);
    expect(pdf.text).toContain("Total USD 1,160.00");
    expect(pdf.text).toContain("Total MXN 1,160.00");
    assertNotesGeometry(name, notes);
  });
});
