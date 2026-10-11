import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EstadoCuentaDocument, type EstadoCuentaRow } from "@/pdf/documents/EstadoCuentaDocument";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";
import { inspectPdf } from "./inspectPdf";
import { pdfWordBounds } from "./inspectPdfLayout";
import { concepto, embarque, proforma } from "./fixtures";

type Word = ReturnType<typeof pdfWordBounds>[number];
const moneyToken = /^-?[\d,]+\.\d{2}$/;
const currencyToken = /^(MXN|USD|EUR)$/;
const geometryEpsilon = 0.02; // Poppler/font floating-point rounding, in points.
const amount = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emisor = {
  organizacionNombre: "Operación QA Linux",
  razonSocial: "Servicios Sintéticos de Integración SA",
  subtitulo: "ENSAYO SINTÉTICO SIN VALOR FISCAL",
  rfc: "AAA010101AAA",
  direccion: "Avenida Ejemplo 123, Monterrey, Nuevo León",
  contacto: "linux@example.test",
};

// Poppler's block order is not the logical order of a split table cell.
// Reconstruct only the relevant words, in visible page/line/column order.
function visualOrder(a: Word, b: Word) {
  return a.page - b.page || (Math.abs(a.yMin - b.yMin) > 2 ? a.yMin - b.yMin : a.xMin - b.xMin);
}

function uniqueWord(words: Word[], text: string): Word {
  const hits = words.filter(word => word.text === text);
  expect(hits, `exactly one visible ${text}`).toHaveLength(1);
  return hits[0];
}

function lineAt(words: Word[], anchor: Word) {
  return words.filter(word => word.page === anchor.page && Math.abs(word.yMin - anchor.yMin) <= 2.5)
    .sort((a, b) => a.xMin - b.xMin);
}

function comesAfter(word: Word, anchor: Word) {
  return word.page > anchor.page || (word.page === anchor.page && word.yMin > anchor.yMin + 2);
}

function assertOwnFirstRow(header: Word, first: Word, maximumGap = 100) {
  expect(first.page, `${header.text} must accompany its own first row ${first.text}`).toBe(header.page);
  expect(first.yMin).toBeGreaterThan(header.yMax);
  expect(first.yMin - header.yMax).toBeLessThan(maximumGap);
}

function assertPages(words: Word[], pdf: Awaited<ReturnType<typeof inspectPdf>>, width: number, height: number) {
  expect(words.length).toBeGreaterThan(0);
  expect(pdf.text).not.toMatch(/undefined|NaN/);
  for (let page = 0; page < pdf.pages; page++) {
    const pageWords = words.filter(word => word.page === page);
    const footer = uniqueWord(pageWords, "Página");
    expect(lineAt(pageWords, footer).map(word => word.text).join(" ")).toBe(
      `Operación QA Linux Generado el 11/10/2026 Página ${page + 1} de ${pdf.pages}`,
    );
    // The footer rule is at 94.5% of the page. Body text must not touch it,
    // including the bottom of glyphs, rather than merely staying on paper.
    const footerWords = new Set(lineAt(pageWords, footer));
    for (const word of pageWords) {
      expect(word.xMin, word.text).toBeGreaterThanOrEqual(0);
      expect(word.xMax, word.text).toBeLessThanOrEqual(width);
      expect(word.yMin, word.text).toBeGreaterThanOrEqual(0);
      expect(word.yMax, word.text).toBeLessThanOrEqual(height);
      if (!footerWords.has(word)) expect(word.yMax, `${word.text} above footer on page ${page + 1}`).toBeLessThan(height * 0.945);
    }
  }
}

describe("Linux integration: row identity, currency and geometry in real PDFs", () => {
  beforeEach(() => {
    // Keep scheduling and the renderer's asynchronous I/O real.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T18:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("preserves each of nine invoices, its own balance/currency, issuer and partial scope", async () => {
    const currencies = ["MXN", "USD", "EUR"];
    const rows: EstadoCuentaRow[] = Array.from({ length: 9 }, (_, i) => ({
      numero: `LINUXFAC${String(i + 1).padStart(2, "0")}`,
      expediente: `LINUXEXP${String(i + 1).padStart(2, "0")}`,
      fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-05", estado: "Emitida",
      moneda: currencies[i % 3], total: 9000 + i + 0.99, saldo: (13721 + i * 11211) / 100,
      diasVencido: i + 1, bucket: "1-30 días",
    }));
    const totalesPorMoneda = currencies.map(moneda => {
      const total = rows.filter(row => row.moneda === moneda).reduce((sum, row) => sum + row.saldo, 0);
      return { moneda, total, buckets: [{ label: "1-30 días", total }] };
    });
    const cliente = {
      nombre: "Comercializadora Sintética Álvarez y Peña",
      rfc: "XAXX010101000", direccion: "Calle Cliente 456", ciudad: "Mérida", estado: "Yucatán",
    };
    const filtros = ["Emisión: 01/10/2026 a 11/10/2026", "Monedas: MXN, USD, EUR", "Sólo con saldo", "Antigüedad: 1-30 días"];
    const before = JSON.stringify({ rows, totalesPorMoneda, cliente, filtros, emisor });
    const name = "linux-integracion-estado-identidad";
    const pdf = await inspectPdf(name, <EstadoCuentaDocument cliente={cliente} rows={rows}
      totalesPorMoneda={totalesPorMoneda} emisor={emisor} alcance={{ parcial: true, filtros }} />);
    expect(JSON.stringify({ rows, totalesPorMoneda, cliente, filtros, emisor })).toBe(before);
    for (const text of [
      ...Object.values(emisor), ...Object.values(cliente), ...filtros,
      "Alcance parcial: subtotales del corte seleccionado.", "Facturas incluidas: 9.",
      "no representan el saldo global del cliente", "Subtotal del corte",
    ]) expect(pdf.text, text).toContain(text);

    const words = pdfWordBounds(name);
    const invoiceWords = words.filter(word => /^LINUXFAC\d{2}$/.test(word.text)).sort(visualOrder);
    expect(invoiceWords.map(word => word.text)).toEqual(rows.map(row => row.numero));
    expect(words.filter(word => /^LINUXEXP\d{2}$/.test(word.text)).sort(visualOrder).map(word => word.text))
      .toEqual(rows.map(row => row.expediente));
    const headers = words.filter(word => word.text === "Factura").sort(visualOrder);
    expect(headers.length).toBeGreaterThan(0); // Never allow an empty heading oracle.
    expect(headers.map(word => word.page)).toEqual([...new Set(invoiceWords.map(word => word.page))]);
    for (const header of headers) {
      const first = invoiceWords.find(word => word.page === header.page)!;
      assertOwnFirstRow(header, first);
      const headerLine = lineAt(words, header).map(word => word.text);
      for (const title of ["Expediente", "Emisión", "Vencimiento", "Días", "Antigüedad", "Estado", "Saldo"]) expect(headerLine).toContain(title);
    }
    for (const row of rows) {
      const invoice = uniqueWord(words, row.numero);
      const expediente = uniqueWord(words, row.expediente);
      const line = lineAt(words, invoice);
      expect(line).toContain(expediente);
      // Distinct input amounts make a swap between rows or currencies fail,
      // even if the document's global multiset of amounts is unchanged.
      expect(line.filter(word => currencyToken.test(word.text)).map(word => word.text)).toEqual([row.moneda]);
      expect(line.filter(word => moneyToken.test(word.text)).map(word => word.text)).toEqual([amount(row.saldo)]);
      const balance = line.find(word => word.text === amount(row.saldo))!;
      const currency = line.find(word => word.text === row.moneda)!;
      uniqueWord(words, amount(row.saldo));
      expect(expediente.xMax).toBeLessThan(currency.xMin);
      expect(currency.xMax).toBeLessThan(balance.xMin);
      expect(balance.xMax).toBeLessThanOrEqual(756 + geometryEpsilon);
      expect(pdf.text).not.toContain(amount(row.total));
    }
    for (const total of totalesPorMoneda) {
      expect(pdf.text).toContain(`SUBTOTAL PENDIENTE ${total.moneda}`);
      expect(pdf.text).toContain(`${total.moneda} ${amount(total.total)}`);
    }
    assertPages(words, pdf, 792, 612);
  });

  it("preserves a middle 300-word row, following compact rows, container and currency boundaries", async () => {
    const longWords = Array.from({ length: 300 }, (_, i) => `segmento${String(i + 1).padStart(3, "0")}`);
    const specs = [
      { marker: "ROWCOMPACTSTART", description: "ROWCOMPACTSTART", container: "LINUXBOXA", currency: "USD", quantity: 2, unit: 111.13 },
      { marker: "ROWTALLSTART", description: `ROWTALLSTART ${longWords.join(" ")} ROWTALLEND`, container: "LINUXBOXA", currency: "USD", quantity: 3, unit: 222.27 },
      { marker: "ROWCOMPACTAFTER", description: "ROWCOMPACTAFTER", container: "LINUXBOXA", currency: "USD", quantity: 4, unit: 333.39 },
      { marker: "ROWNEXTBOX", description: "ROWNEXTBOX", container: "LINUXBOXB", currency: "USD", quantity: 5, unit: 444.41 },
      { marker: "ROWNEXTCURRENCY", description: "ROWNEXTCURRENCY", container: "LINUXBOXB", currency: "MXN", quantity: 6, unit: 555.53 },
    ] as const;
    const conceptos = specs.map((row, i) => concepto(i + 1, {
      descripcion: row.description, cantidad: row.quantity, precio_unitario: row.unit, total: row.quantity * row.unit,
      moneda: row.currency, aplica_iva: false, tasa_iva_aplicada: 0, tipo_iva: "no_objeto",
      contenedor_id: row.container,
      embarque_contenedores: { id: row.container, numero_contenedor: row.container, tipo_contenedor: "40HC" },
    }));
    // Stored totals are deliberately discriminating: the presentation must
    // print its supplied summary, not silently replace it with row arithmetic.
    const stored = { ...proforma, subtotal_usd: 9876.54, iva_usd: 0, total_usd: 9876.54, subtotal_mxn: 8765.43, iva_mxn: 0, total_mxn: 8765.43, notas: "" };
    const before = JSON.stringify({ conceptos, stored });
    const name = "linux-integracion-proforma-alta-intermedia";
    const pdf = await inspectPdf(name, <ProformaDocument emisor={emisor} embarque={embarque} proforma={stored} conceptos={conceptos} />);
    expect(JSON.stringify({ conceptos, stored })).toBe(before);
    expect(pdf.pages).toBeGreaterThan(1);
    const words = pdfWordBounds(name);
    const markers = [...specs.slice(0, 2).map(row => row.marker), ...longWords, "ROWTALLEND", ...specs.slice(2).map(row => row.marker)];
    const markerSet = new Set(markers);
    const descriptionWords = words.filter(word => markerSet.has(word.text)).sort(visualOrder);
    expect(descriptionWords.map(word => word.text)).toEqual(markers);
    expect(words.filter(word => /^segmento\d+$/.test(word.text)).sort(visualOrder).map(word => word.text)).toEqual(longWords);
    for (const marker of markers) uniqueWord(words, marker);

    const first = uniqueWord(words, "ROWCOMPACTSTART");
    const final = uniqueWord(words, "ROWNEXTCURRENCY");
    const tallStart = uniqueWord(words, "ROWTALLSTART");
    const tallEnd = uniqueWord(words, "ROWTALLEND");
    expect(tallEnd.page).toBeGreaterThan(tallStart.page); // Actually exercise row continuation.
    const conceptHeadings = words.filter(word => word.text === "Conceptos").sort(visualOrder);
    expect(conceptHeadings).toHaveLength(3); // Overall title plus one per currency.
    const headingLines = conceptHeadings.map(header => lineAt(words, header).map(word => word.text).join(" "));
    expect(headingLines).toEqual(["Conceptos por Contenedor", "Conceptos en USD", "Conceptos en MXN"]);
    // The overall title precedes the currency title, container chip and table header.
    assertOwnFirstRow(conceptHeadings[0], first, 140);
    assertOwnFirstRow(conceptHeadings[1], first);
    assertOwnFirstRow(conceptHeadings[2], final);

    const expectedGroups = [
      { container: "LINUXBOXA", first: "ROWCOMPACTSTART", last: "ROWCOMPACTAFTER", currency: "USD", subtotal: 222.26 + 666.81 + 1333.56 },
      { container: "LINUXBOXB", first: "ROWNEXTBOX", last: "ROWNEXTBOX", currency: "USD", subtotal: 2222.05 },
      { container: "LINUXBOXB", first: "ROWNEXTCURRENCY", last: "ROWNEXTCURRENCY", currency: "MXN", subtotal: 3333.18 },
    ];
    const chips = words.filter(word => /^LINUXBOX[AB]$/.test(word.text)).sort(visualOrder);
    expect(chips.map(word => word.text)).toEqual(expectedGroups.map(group => group.container));
    const rowStarts = specs.map(row => uniqueWord(words, row.marker));
    for (const [index, group] of expectedGroups.entries()) {
      const chip = chips[index];
      const ownFirst = uniqueWord(words, group.first);
      assertOwnFirstRow(chip, ownFirst);
      expect(rowStarts.filter(row => comesAfter(row, chip)).sort(visualOrder)[0]).toBe(ownFirst);
      const last = uniqueWord(words, group.last);
      const subtotal = words.filter(word => word.text === "Subtotal" && comesAfter(word, last)).sort(visualOrder)[0];
      expect(subtotal).toBeDefined();
      expect(subtotal.page).toBe(last.page);
      expect(lineAt(words, subtotal).map(word => word.text).join(" "))
        .toBe(`Subtotal ${group.currency}: ${group.currency} ${amount(group.subtotal)}`);
      if (chips[index + 1]) expect(comesAfter(chips[index + 1], subtotal)).toBe(true);
    }

    const tableHeaders = words.filter(word => word.text === "Descripción").sort(visualOrder);
    expect(tableHeaders.length).toBeGreaterThanOrEqual(expectedGroups.length);
    for (const header of tableHeaders) {
      const nextHeader = tableHeaders.find(other => other.page === header.page && other.yMin > header.yMin + 2);
      const nextChip = chips.find(other => other.page === header.page && other.yMin > header.yMin + 2);
      const ownContent = descriptionWords.filter(word => word.page === header.page && word.yMin > header.yMax &&
        (!nextHeader || word.yMin < nextHeader.yMin) && (!nextChip || word.yMin < nextChip.yMin));
      expect(ownContent.length, `nonempty table under header on page ${header.page + 1}`).toBeGreaterThan(0);
      const activeChip = chips.filter(chip => comesAfter(header, chip)).at(-1)!;
      expect(activeChip).toBeDefined();
      const group = expectedGroups[chips.indexOf(activeChip)];
      const allowed = new Set(specs.filter(row => row.container === group.container && row.currency === group.currency)
        .flatMap(row => row.description.split(" ")));
      for (const word of ownContent) {
        expect(allowed.has(word.text), `${word.text} belongs to ${group.container}/${group.currency}`).toBe(true);
        // 540pt table - 54pt tax treatment - 38pt quantity - two 78pt money cells,
        // minus 5pt cell padding: description glyphs stop at x=323.
        expect(word.xMin).toBeGreaterThanOrEqual(41 - geometryEpsilon);
        expect(word.xMax, `${word.text} stays in description column`).toBeLessThanOrEqual(323 + geometryEpsilon);
      }
    }

    for (const row of specs) {
      const anchor = uniqueWord(words, row.marker);
      const line = lineAt(words, anchor);
      expect(line.filter(word => currencyToken.test(word.text)).map(word => word.text)).toEqual([row.currency, row.currency]);
      expect(line.filter(word => moneyToken.test(word.text)).map(word => word.text)).toEqual([amount(row.unit), amount(row.quantity * row.unit)]);
      const numeric = line.filter(word => moneyToken.test(word.text));
      expect(numeric[0].xMax).toBeLessThan(numeric[1].xMin);
      expect(line.filter(word => word.text === String(row.quantity) && word.xMin > anchor.xMax && word.xMax < numeric[0].xMin)).toHaveLength(1);
      const currencies = line.filter(word => currencyToken.test(word.text));
      expect(currencies[0].xMin).toBeGreaterThanOrEqual(425 - geometryEpsilon);
      expect(numeric[0].xMax).toBeLessThanOrEqual(493 + geometryEpsilon);
      expect(currencies[1].xMin).toBeGreaterThanOrEqual(503 - geometryEpsilon);
      expect(numeric[1].xMax).toBeLessThanOrEqual(571 + geometryEpsilon);
    }
    const storedSubtotals = words.filter(word => word.text === "Subtotal" && lineAt(words, word).length === 3);
    expect(storedSubtotals).toHaveLength(2);
    for (const [currency, value] of [["USD", 9876.54], ["MXN", 8765.43]] as const) {
      const matches = words.filter(word => word.text === amount(value));
      expect(matches).toHaveLength(2); // One supplied subtotal and one supplied total.
      for (const match of matches) {
        expect(match.page).toBe(final.page);
        expect(match.yMin).toBeGreaterThan(final.yMax);
        expect(lineAt(words, match).filter(word => currencyToken.test(word.text)).map(word => word.text)).toEqual([currency]);
      }
    }
    const expectedAmounts = [
      ...specs.flatMap(row => [row.unit, row.quantity * row.unit]),
      ...expectedGroups.map(group => group.subtotal),
      9876.54, 9876.54, 8765.43, 8765.43,
    ].map(amount).sort();
    expect(words.filter(word => moneyToken.test(word.text)).map(word => word.text).sort()).toEqual(expectedAmounts);
    for (const [index, word] of descriptionWords.entries()) {
      const next = descriptionWords[index + 1];
      if (!next || next.page !== word.page) continue;
      if (Math.abs(next.yMin - word.yMin) <= 2) expect(word.xMax).toBeLessThan(next.xMin);
      else expect(word.yMax).toBeLessThan(next.yMin);
    }
    assertPages(words, pdf, 612, 792);
  });
});
