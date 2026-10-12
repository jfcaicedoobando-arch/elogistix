import { describe, expect, it } from "vitest";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";
import type { EmbarqueLite } from "@/pdf/documents/proformaShared";
import { inspectPdf } from "./inspectPdf";
import { pdfWordBounds } from "./inspectPdfLayout";
import { concepto, embarque, proforma } from "./fixtures";

// Synthetic counterpart of the two-row layout that used to leave notes alone.
const notas = "Maniobras de carga y descarga de 12 tarimas en Santa Catarina–Apodaca. Prueba de redondeo por concepto; sin envío ni cobro.";
const corta = { ...proforma, numero: "PRO-PAGINACION-0012", fecha_emision: "2026-09-30",
  operador: "operaciones@example.test", dias_credito: null, notas,
  subtotal_usd: 0, iva_usd: 0, total_usd: 0,
  subtotal_mxn: 3066.66, iva_mxn: 490.6656, total_mxn: 3557.3256 };
const viaje: EmbarqueLite = { ...embarque, modo: "Terrestre", tipo: "Nacional", incoterm: "N/A",
  puerto_origen: null, puerto_destino: null, ciudad_origen: "Santa Catarina, Nuevo León",
  ciudad_destino: "Apodaca, Nuevo León", descripcion_mercancia: "12 tarimas de piezas de acero para planta industrial en Apodaca" };
const cliente = { nombre: "Cliente industrial de prueba", rfc: "XAXX010101000",
  direccion: "Parque Industrial de prueba, nave sin domicilio real", ciudad: "Apodaca", estado: "Nuevo León", cp: "66600" };
const emisor = { organizacionNombre: "Logística QA" };
const filas = [concepto(1, { descripcion: "Maniobras de carga en Santa Catarina", precio_unitario: 1533.33 }),
  concepto(2, { descripcion: "Maniobras de descarga en Apodaca", precio_unitario: 1533.33 })];
const textMoney = (text: string) => text.replace(/(\d)\s+\./g, "$1.");

function assertBounds(name: string) {
  const words = pdfWordBounds(name);
  for (const word of words) {
    expect(word.xMin).toBeGreaterThanOrEqual(35.5);
    expect(word.xMax).toBeLessThanOrEqual(576.5);
    // Font glyph bounds may extend below their line box. Keep a 6pt gap
    // above the footer rule at 748pt on LETTER portrait.
    const footerToken = /^(Logística|QA|Generado|el|Página|de|\d+|\d{2}\/\d{2}\/\d{4})$/u.test(word.text);
    const inFooter = footerToken && word.yMin >= 747 && word.yMax <= 773;
    expect(word.yMax <= 742 || inFooter, JSON.stringify(word)).toBe(true);
  }
  return words;
}

function assertClosing(name: string, lastMarker: string) {
  const words = assertBounds(name);
  const last = words.find(w => w.text === lastMarker);
  const notes = words.find(w => w.text === "Notas");
  const totals = words.filter(w => w.text === "Subtotal").at(-1);
  expect(last).toBeDefined();
  expect(notes).toBeDefined();
  expect(totals).toBeDefined();
  expect(last?.page).toBe(notes?.page);
  expect(last?.page).toBe(totals?.page);
}

describe("PDF real: cierre de proforma con notas", () => {
  it("dos conceptos y notas breves caben en una página sin cambiar importes ni campos", async () => {
    const name = "proforma-notas-corta";
    const before = JSON.stringify({ corta, viaje, filas });
    const pdf = await inspectPdf(name, <ProformaDocument proforma={corta} embarque={viaje} cliente={cliente} conceptos={filas} emisor={emisor} />);
    expect(pdf.pages).toBe(1);
    const text = textMoney(pdf.text);
    for (const value of ["Subtotal MXN 3,066.66 IVA MXN 490.66 Total MXN 3,557.32", "XAXX010101000", "Santa Catarina", "Apodaca", "Transferencia electrónica", notas]) expect(text).toContain(value);
    expect(text).not.toContain("3,557.33");
    expect(JSON.stringify({ corta, viaje, filas })).toBe(before);
    assertBounds(name);
  });

  it("40 filas conservan la última fila, notas y totales juntos", async () => {
    const name = "proforma-notas-larga";
    const rows = Array.from({ length: 40 }, (_, i) => concepto(i + 1, { descripcion: `Servicio${i + 1} coordinación de mercancía en destino` }));
    const pdf = await inspectPdf(name, <ProformaDocument proforma={corta} embarque={viaje} conceptos={rows} emisor={emisor} />);
    expect(pdf.pages).toBeGreaterThan(1);
    expect(pdf.text.match(/\bServicio\d+\b/g)).toEqual(rows.map((_, i) => `Servicio${i + 1}`));
    expect(textMoney(pdf.text)).toContain("Total MXN 46,400.00");
    assertClosing(name, "Servicio40");
  });

  it("dos monedas y varios contenedores conservan ambos cierres y todas las filas", async () => {
    const name = "proforma-notas-multimoneda";
    const rows = Array.from({ length: 24 }, (_, i) => concepto(i + 1, {
      descripcion: `Cargo${i + 1} coordinación logística`, moneda: i % 2 ? "MXN" : "USD",
      precio_unitario: i % 2 ? 1000 : 1800, aplica_iva: Boolean(i % 2), tasa_iva_aplicada: i % 2 ? 0.16 : 0, tipo_iva: i % 2 ? "tasa_16" : "no_objeto",
      embarque_contenedores: { id: i < 12 ? "a" : "b", numero_contenedor: i < 12 ? "DEMO0000001" : "DEMO0000002", tipo_contenedor: "40HC" },
    }));
    const pdf = await inspectPdf(name, <ProformaDocument proforma={corta} embarque={viaje} conceptos={rows} emisor={emisor} />);
    const text = textMoney(pdf.text);
    for (const value of ["Conceptos en USD", "Conceptos en MXN", "Subtotal USD 21,600.00 Total USD 21,600.00", "Subtotal MXN 12,000.00 IVA MXN 1,920.00 Total MXN 13,920.00"]) expect(text).toContain(value);
    for (let i = 1; i <= 24; i++) expect(text.match(new RegExp(`\\bCargo${i}\\b`, "g"))).toHaveLength(1);
    assertClosing(name, "Cargo24");
  });

  it("notas extensas continúan a ancho completo sin perder ni duplicar su final", async () => {
    const name = "proforma-notas-extensas";
    const notes = Array.from({ length: 40 }, (_, i) => `Condición${i + 1}: ${"Coordinar la entrega con el responsable de almacén. ".repeat(5)}`).join("\n\n");
    const pdf = await inspectPdf(name, <ProformaDocument proforma={{ ...corta, notas: notes }} embarque={viaje} conceptos={filas} emisor={emisor} />);
    expect(pdf.pages).toBeGreaterThan(2);
    expect(pdf.text.match(/\bCondición\d+:/g)).toEqual(Array.from({ length: 40 }, (_, i) => `Condición${i + 1}:`));
    expect(pdf.text.match(/\bNotas\b/g)).toHaveLength(1);
    assertBounds(name);
  });

  it("una descripción mayor que la página sigue fluyendo con notas y totales", async () => {
    const name = "proforma-notas-fila-extensa";
    const description = `InicioExtenso ${"Revisión documental y coordinación de entrega. ".repeat(160)} FinExtenso`;
    const pdf = await inspectPdf(name, <ProformaDocument proforma={corta} embarque={viaje} conceptos={[concepto(1, { descripcion: description })]} emisor={emisor} />);
    expect(pdf.pages).toBeGreaterThan(2);
    expect(pdf.text.match(/InicioExtenso/g)).toHaveLength(1);
    expect(pdf.text.match(/FinExtenso/g)).toHaveLength(1);
    expect(textMoney(pdf.text)).toContain("Total MXN 1,160.00");
    expect(pdf.text).toContain(notas);
    assertBounds(name);
  });

  it("grupo en el presupuesto límite, dos monedas y avisos permanecen dentro de la página", async () => {
    const name = "proforma-notas-limite";
    // NaN represents an unknown numeric VAT rate and preserves the estimated-VAT path.
    const rows = [concepto(1, { moneda: "USD", aplica_iva: false, tasa_iva_aplicada: 0, tipo_iva: "no_objeto", descripcion: "CargoUSD", embarque_contenedores: { id: "a", numero_contenedor: "DEMO0000001", tipo_contenedor: "40HC" } }),
      concepto(2, { descripcion: Array.from({ length: 19 }, (_, i) => `Línea${i + 1}`).join("\n"), tipo_iva: null, tasa_iva_aplicada: Number.NaN, embarque_contenedores: { id: "b", numero_contenedor: "DEMO0000002", tipo_contenedor: "40HC" } })];
    const notes = "WWWW entrega de mercancía con coordinación documental y revisión de condiciones operativas para evitar demoras. Confirmar disponibilidad de recepción antes del traslado al almacén.";
    const pdf = await inspectPdf(name, <ProformaDocument proforma={{ ...corta, notas: notes }} embarque={viaje} conceptos={rows} emisor={emisor} />);
    expect(pdf.text).toContain("Línea19");
    expect(pdf.text).toContain("Confirmar disponibilidad");
    expect(pdf.text).toContain("ESTIMADO");
    assertClosing(name, "Línea19");
  });

  for (const notes of [null, "[interno] Ocultar este recordatorio"]) {
    it(`sin notas visibles (${notes === null ? "vacías" : "internas"}) no agrega un cierre vacío`, async () => {
      const name = notes === null ? "proforma-notas-vacias" : "proforma-notas-internas";
      const pdf = await inspectPdf(name, <ProformaDocument proforma={{ ...corta, notas: notes }} embarque={viaje} conceptos={filas} emisor={emisor} />);
      expect(pdf.pages).toBe(1);
      expect(pdf.text).not.toContain("Notas");
      expect(pdf.text).not.toContain("Ocultar");
      assertBounds(name);
    });
  }

  it("sin conceptos ni totales conserva notas a ancho completo", async () => {
    const name = "proforma-notas-sin-totales";
    const pdf = await inspectPdf(name, <ProformaDocument proforma={{ ...corta, subtotal_mxn: 0, iva_mxn: 0, total_mxn: 0 }} embarque={viaje} conceptos={[]} emisor={emisor} />);
    expect(pdf.text).toContain("Sin conceptos para mostrar.");
    expect(pdf.text).toContain(notas);
    expect(pdf.text).not.toContain("Subtotal");
    assertBounds(name);
  });
});
