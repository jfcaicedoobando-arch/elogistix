import { describe, expect, it } from "vitest";
import { EstadoCuentaDocument } from "@/pdf/documents/EstadoCuentaDocument";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";
import { inspectPdf } from "./inspectPdf";
import { pdfWordBounds } from "./inspectPdfLayout";
import { concepto, cotizacion, embarque, proforma } from "./fixtures";

const emisor = {
  organizacionNombre: "Operación logística sintética México, Europa y Norteamérica",
  razonSocial: "Servicios Integrales de Transportación y Coordinación Internacional de Ejemplo, S.A. de C.V.",
  subtitulo: "Muestra visual con datos sintéticos", rfc: "AAA010101AAA",
  direccion: "Avenida de Ejemplo 123, Parque Industrial Sintético, Monterrey, Nuevo León, México",
  contacto: "operaciones@example.test",
};
const cliente = { nombre: "Comercializadora Industrial Sintética de Refacciones y Equipos de Precisión Álvarez, Peña & Müller", rfc: "XAXX010101000" };

describe("Paginación final de PDFs internos con datos sintéticos", () => {
  it("estado de cuenta con tres monedas mantiene encabezado y primera fila juntos", async () => {
    const monedas = ["MXN", "USD", "EUR"];
    const rows = Array.from({ length: 9 }, (_, i) => ({ numero: `FAC-DEMO-2026-${String(i + 1).padStart(3, "0")}`, expediente: `EXP-SINTETICO-2026-${i + 1}`, fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-05", estado: "Emitida", moneda: monedas[i % 3], total: 1234567.89, saldo: 1234567.89, diasVencido: 2, bucket: "1-30 días" }));
    const totalesPorMoneda = monedas.map(moneda => ({ moneda, total: 3703703.67, buckets: [{ label: "1-30 días", total: 3703703.67 }] }));
    const pdf = await inspectPdf("final-estado-cuenta-tres-monedas", <EstadoCuentaDocument cliente={cliente} rows={rows} totalesPorMoneda={totalesPorMoneda} emisor={emisor} alcance={{ parcial: true, filtros: ["Corte sintético: octubre 2026"] }} />);
    for (const moneda of monedas) for (const monto of ["1,234,567.89", "3,703,703.67"]) expect(pdf.text).toContain(`${moneda} ${monto}`);
    expect(pdf.rawText.replace(/\s/g, "")).toContain(cliente.nombre.replace(/\s/g, ""));
    expect(pdf.rawText.replace(/\s/g, "")).toContain("FAC-DEMO-2026-009");
    const words = pdfWordBounds("final-estado-cuenta-tres-monedas");
    const headers = words.filter(word => word.text === "Factura");
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) {
      expect(words.some(word => word.page === header.page && word.text.startsWith("FAC-DEMO-"))).toBe(true);
    }
    expect(pdf.text).toContain(`Página ${pdf.pages} de ${pdf.pages}`);
  });
  it("proforma con nombres largos, dos monedas y millones conserva título y concepto", async () => {
    const conceptos = [concepto(1, { descripcion: "Servicio documental sintético de prueba en moneda nacional", precio_unitario: 1234567.89, total: 1234567.89 }), concepto(2, { descripcion: "Servicio internacional sintético de prueba", moneda: "USD", aplica_iva: false, tasa_iva_aplicada: 0, tipo_iva: "no_objeto", precio_unitario: 2345678.9, total: 2345678.9 })];
    const pdf = await inspectPdf("final-proforma-millones", <ProformaDocument emisor={emisor} embarque={embarque} proforma={{ ...proforma, cliente_nombre: cliente.nombre, subtotal_mxn: 1234567.89, iva_mxn: 197530.86, total_mxn: 1432098.75, subtotal_usd: 2345678.9, iva_usd: 0, total_usd: 2345678.9 }} conceptos={conceptos} />);
    for (const text of ["MXN 1,234,567.89", "MXN 1,432,098.75", "USD 2,345,678.90", "No objeto", "Documento sin validez fiscal"]) expect(pdf.text).toContain(text);
    const words = pdfWordBounds("final-proforma-millones");
    const heading = words.find(word => word.text === "USD" && words.some(prev => prev.page === word.page && Math.abs(prev.yMin - word.yMin) < 2 && prev.text === "Conceptos"));
    expect(heading).toBeDefined();
    expect(words.find(word => word.text === "internacional")?.page).toBe(heading?.page);
    expect(words.find(word => word.text === "Subtotal")?.page).toBe(words.find(word => word.text === "nacional")?.page);
  });
  it("cotización conserva nombres largos, dos monedas y millones", async () => {
    const cot = { ...cotizacion, cliente_nombre: cliente.nombre, conceptos_venta: cotizacion.conceptos_venta.map((c, i) => ({ ...c, precio_unitario: i ? 1234567.89 : 2345678.9, total: i ? 1234567.89 : 2345678.9 })) };
    const pdf = await inspectPdf("final-cotizacion-millones", <CotizacionDocument cotizacion={cot} emisor={emisor} />);
    for (const text of ["USD 2,345,678.90", "MXN 1,432,098.75", "Cotización"]) expect(pdf.text).toContain(text);
    expect(pdf.rawText.replace(/\s/g, "")).toContain(cliente.nombre.replace(/\s/g, ""));
  });
  it.each([1, 2, 12, 25, 40])("conserva última fila y total de proforma con %i conceptos", async (count) => {
    const conceptos = Array.from({ length: count }, (_, i) => concepto(i + 1, {
      descripcion: `FINAL${i + 1} servicio sintético de coordinación de mercancía y revisión documental internacional`,
    }));
    const name = `final-proforma-borde-${count}`;
    const pdf = await inspectPdf(name, <ProformaDocument emisor={emisor} embarque={embarque}
      proforma={{ ...proforma, subtotal_usd: 0, total_usd: 0, subtotal_mxn: count * 1000, iva_mxn: count * 160, total_mxn: count * 1160 }} conceptos={conceptos} />);
    const words = pdfWordBounds(name);
    const last = words.find(word => word.text === `FINAL${count}`);
    const total = words.find(word => word.text === "Subtotal");
    expect(last).toBeDefined();
    expect(total).toBeDefined();
    expect(last?.page).toBe(total?.page);
    for (let i = 1; i <= count; i++) expect(pdf.text).toContain(`FINAL${i}`);
  });
  it("proforma de varios contenedores conserva subtotales y cierre en la última fila", async () => {
    const conceptos = Array.from({ length: 12 }, (_, i) => concepto(i + 1, {
      descripcion: `MULTI${i + 1} servicio sintético por contenedor`,
      moneda: i < 6 ? "USD" : "MXN",
      embarque_contenedores: { id: i % 6 < 3 ? "container-a" : "container-b", numero_contenedor: i % 6 < 3 ? "DEMO0000001" : "DEMO0000002", tipo_contenedor: "40HC" },
    }));
    const name = "final-proforma-multicontenedor";
    const pdf = await inspectPdf(name, <ProformaDocument emisor={emisor} embarque={embarque}
      proforma={{ ...proforma, subtotal_usd: 6000, iva_usd: 960, total_usd: 6960, subtotal_mxn: 6000, iva_mxn: 960, total_mxn: 6960 }} conceptos={conceptos} />);
    for (const text of ["USD 6,960.00", "MXN 6,960.00", "DEMO0000001", "DEMO0000002"]) expect(pdf.text).toContain(text);
    for (let i = 1; i <= 12; i++) expect(pdf.text).toContain(`MULTI${i}`);
    const words = pdfWordBounds(name);
    const headings = words.filter(word => word.text === "Conceptos");
    expect(headings).toHaveLength(3);
    for (const heading of headings) {
      expect(words.some(word => word.page === heading.page && /^MULTI\d+$/.test(word.text))).toBe(true);
    }
    const last = words.find(word => word.text === "MULTI12");
    const storedTotals = words.find(word => word.text === "6,960.00");
    expect(last).toBeDefined();
    expect(storedTotals).toBeDefined();
    expect(last?.page).toBe(storedTotals?.page);
  });

});
