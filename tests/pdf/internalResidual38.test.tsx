import { describe, expect, it } from "vitest";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";
import { EstadoCuentaProveedorDocument } from "@/pdf/documents/EstadoCuentaProveedorDocument";
import { ReporteEERRDocument } from "@/pdf/documents/ReporteEERRDocument";
import { buildEstadoResultados } from "@/features/profit/domain/estadoResultados";
import { makeCotizacionRow } from "@/test/fixtures/cotizacionFactory";
import { inspectPdf } from "./inspectPdf";
import { pdfWordBounds } from "./inspectPdfLayout";

const cotizacion = makeCotizacionRow({
  folio: "COT-DEMO-UNICA", cliente_nombre: "Cliente industrial de ejemplo para logística",
  modo: "Terrestre", tipo: "Nacional", incoterm: "N/A", origen: "Santa Catarina, Nuevo León", destino: "Apodaca, Nuevo León",
  created_at: "2026-10-07T12:00:00Z", fecha_vigencia: "2026-10-22", estado: "En operación",
  operador: "operaciones@example.test", peso_kg: 1, volumen_m3: 0, piezas: 1, tipo_cambio_usd: 0,
  descripcion_mercancia: "Perfiles para traslado entre municipios de Nuevo León", notas: "",
  conceptos_venta: [{ descripcion: "Coordinación de entrega documental", cantidad: 1, unidad_medida: "E48", precio_unitario: 2, total: 2,
    moneda: "MXN", aplica_iva: false, tasa_iva_aplicada: 0, tipo_iva: "no_objeto" }],
});

describe("Regresiones de presentación de documentos internos", () => {
  it("mantiene una cotización terrestre de un concepto y sus totales en una página", async () => {
    const pdf = await inspectPdf("residual-cotizacion-un-concepto", <CotizacionDocument cotizacion={cotizacion}
      emisor={{ razonSocial: "Empresa", organizacionNombre: "Operación logística sintética" }} />);
    expect(pdf.pages).toBe(1);
    for (const text of ["COT-DEMO-UNICA", "Coordinación de entrega documental", "No objeto", "Subtotal", "Total", "MXN 2.00"]) expect(pdf.text).toContain(text);
    expect(pdf.text.match(/Operación logística sintética/g)).toHaveLength(2);
    expect(pdf.text).not.toMatch(/Documento interno|RFC:/);
  });
  it("acompaña los totales con la última fila en una cotización larga", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ ...cotizacion.conceptos_venta[0], descripcion: `Servicio documental ITEM-${i + 1}` }));
    const pdf = await inspectPdf("residual-cotizacion-larga", <CotizacionDocument cotizacion={{ ...cotizacion, conceptos_venta: rows }} />);
    expect(pdf.pages).toBeGreaterThan(1);
    expect(pdf.text).toContain("MXN 80.00");
    const words = pdfWordBounds("residual-cotizacion-larga");
    const last = words.find((word) => word.text === "ITEM-40")!;
    expect(last).toBeDefined();
    expect(words.find((word) => word.text === "Total")?.page).toBe(last.page);
    for (let i = 1; i <= 40; i++) expect(pdf.text).toContain(`ITEM-${i}`);
  });

  it("conserva folios y referencias largas del proveedor sin alterar cifras", async () => {
    const folio = "BON-DEMO-071026-01";
    const uuid = "a1234567-b890-4cde-8f01-234567890abc";
    const pdf = await inspectPdf("residual-proveedor-identificadores", <EstadoCuentaProveedorDocument
      proveedorNombre="Proveedor sintético" desde="2026-10-01" hasta="2026-10-07" aging={[]} saldos={[]}
      movimientos={[{ fecha: "2026-10-06", tipo: "Nota de crédito", folio, expediente: "EXP-DEMO-1234567890", referencia: uuid, moneda: "MXN", cargo: "0", abono: "1.16", saldo: "2661.90" }]} />);
    const compact = pdf.rawText.replace(/\s/g, "");
    expect(compact).toContain(folio);
    expect(compact).toContain(uuid);
    for (const text of ["MXN 0.00", "MXN 1.16", "MXN 2,661.90"]) expect(pdf.text).toContain(text);
    const words = pdfWordBounds("residual-proveedor-identificadores");
    const date = words.find((word) => word.text === "06/10/2026")!;
    for (const [left, right, expected] of [[165, 242, folio], [317, 454, uuid]] as const) {
      const cellWords = words.filter((word) => word.page === date.page && word.yMin >= date.yMin && word.yMin < date.yMin + 70 && word.xMin >= left && word.xMin < right);
      expect(cellWords.map((word) => word.text).join("")).toBe(expected);
      expect(cellWords.every((word) => word.xMax <= right - 5)).toBe(true);
    }
  });

  it("mantiene el resumen por modo junto a un EERR corto con aviso provisional", async () => {
    const data = buildEstadoResultados([{ id: "demo", modo: "Terrestre", tipo_cambio_usd: 18, tipo_cambio_eur: 20 }],
      [{ embarque_id: "demo", descripcion: "Facturación", total: 5000, moneda: "MXN" }, { embarque_id: "demo", descripcion: "Notas de crédito", total: -225, moneda: "MXN" }],
      [{ embarque_id: "demo", concepto: "Facturas de proveedor", monto: 9750, moneda: "MXN" }, { embarque_id: "demo", concepto: "Notas de crédito de proveedor", monto: -22, moneda: "MXN" }]);
    data.notas_proveedor_sin_base = ["a", "b", "c", "d"];
    const pdf = await inspectPdf("residual-eerr-corto", <ReporteEERRDocument periodo="2026-10" fuente="facturas" data={data} />);
    expect(pdf.pages).toBe(1);
    for (const text of ["Reporte provisional", "Notas de crédito de proveedor", "Utilidad por modo", "MXN -4,953.00"]) expect(pdf.text).toContain(text);
  });
  it("conserva todos los identificadores y monedas en un estado de proveedor extenso", async () => {
    const monedas = ["MXN", "USD", "EUR"];
    const movimientos = Array.from({ length: 53 }, (_, i) => ({ fecha: "2026-10-06", tipo: "Nota de crédito", folio: `BON-DEMO-${String(i + 1).padStart(3, "0")}-071026`,
      expediente: `EXP-DEMO-${i + 1}`, referencia: `Referencia documental ${i + 1}: a1234567-b890-4cde-8f01-234567890abc`, moneda: monedas[i % 3], cargo: "0", abono: "1.16", saldo: "2661.90" }));
    const pdf = await inspectPdf("residual-proveedor-largo", <EstadoCuentaProveedorDocument proveedorNombre="Proveedor sintético"
      desde="2026-10-01" hasta="2026-10-07" aging={[]} saldos={[]} movimientos={movimientos}
      emisor={{ organizacionNombre: "Operación logística sintética" }} />);
    expect(pdf.pages).toBeGreaterThan(2);
    const compact = pdf.rawText.replace(/\s/g, "");
    for (const row of movimientos) expect(compact).toContain(row.folio);
    for (const moneda of monedas) expect(pdf.text).toContain(`${moneda} 2,661.90`);
    expect(pdf.text).toContain(`Página ${pdf.pages} de ${pdf.pages}`);
  });
});
