import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { makeEmbarque, makeProforma } from "@/test/fixtures";
import { ProformaDocument } from "../ProformaDocument";
import { columnasMXN, type ConceptoVenta } from "../proformaConceptosColumns";

const embarque = makeEmbarque();
function fila(id: string, overrides: Partial<ConceptoVenta> = {}): ConceptoVenta {
  // SAFE-CAST: sólo se consumen estos campos del concepto en el documento.
  return { id, descripcion: `Servicio sintético ${id}`, cantidad: 1, precio_unitario: 1533.33,
    moneda: "MXN", aplica_iva: true, tasa_iva_aplicada: 0.16, tipo_iva: "gravado_16", ...overrides } as ConceptoVenta;
}

const encabezadoRedondeo = makeProforma({ subtotal_usd: 0, iva_usd: 0, total_usd: 0,
  subtotal_mxn: 3066.66, iva_mxn: 490.6656, total_mxn: 3557.3256 });

describe("proforma PDF: totales canónicos BL-12 y monedas documentales", () => {
  it("suma el IVA redondeado de cada fila, como detalle/listado, sin modificar entradas", () => {
    const conceptos = [fila("a"), fila("b")];
    const before = JSON.stringify({ proforma: encabezadoRedondeo, conceptos });
    const { container } = render(<ProformaDocument proforma={encabezadoRedondeo} embarque={embarque} conceptos={conceptos} />);
    const text = container.textContent ?? "";
    expect(text.match(/MXN 245\.33/g)).toHaveLength(2);
    expect(text.match(/MXN 1,778\.66/g)).toHaveLength(2);
    expect(text).toContain("SubtotalMXN 3,066.66IVAMXN 490.66TotalMXN 3,557.32");
    expect(text).not.toContain("490.67");
    expect(text).not.toContain("3,557.33");
    expect(JSON.stringify({ proforma: encabezadoRedondeo, conceptos })).toBe(before);
  });

  it("conserva USD y MXN separados aunque la cabecera histórica incluya un equivalente", () => {
    const proforma = makeProforma({ subtotal_usd: 3156.75, iva_usd: 0, total_usd: 3156.75,
      subtotal_mxn: 61638.15, iva_mxn: 1152, total_mxn: 62790.15 });
    const conceptos = [fila("usd", { moneda: "USD", precio_unitario: 3156.75, aplica_iva: false, tipo_iva: "no_objeto" }),
      fila("mxn", { precio_unitario: 7200 })];
    const { container } = render(<ProformaDocument proforma={proforma} embarque={embarque} conceptos={conceptos} />);
    const text = container.textContent ?? "";
    expect(text).toContain("SubtotalUSD 3,156.75TotalUSD 3,156.75");
    expect(text).toContain("SubtotalMXN 7,200.00IVAMXN 1,152.00TotalMXN 8,352.00");
    expect(text).not.toContain("62,790.15");
    expect(text).not.toContain("61,638.15");
  });

  it("respeta tasas mixtas, no objeto y flag legacy sin inventar IVA", () => {
    const conceptos = [fila("general", { precio_unitario: 100 }),
      fila("frontera", { precio_unitario: 100, tipo_iva: "gravado_8" }),
      fila("no-objeto", { precio_unitario: 100, tipo_iva: "no_objeto" }),
      fila("legacy", { precio_unitario: 100, tipo_iva: null, aplica_iva: false })];
    const { container } = render(<ProformaDocument proforma={encabezadoRedondeo} embarque={embarque} conceptos={conceptos} tasaIva={0.12} />);
    expect(container.textContent).toContain("SubtotalMXN 400.00IVAMXN 20.00TotalMXN 420.00");
    expect(container.textContent).not.toContain("IVA (12%)");
    expect(container.textContent).not.toContain("ESTIMADO");
  });

  it("sin desglose conserva el importe guardado y lo identifica explícitamente", () => {
    const { container } = render(<ProformaDocument proforma={encabezadoRedondeo} embarque={embarque} conceptos={[]} />);
    expect(container.textContent).toContain("TotalMXN 3,557.33");
    expect(container.textContent).toContain("Detalle de conceptos no disponible. Se conserva el importe guardado.");
  });

  it.each([
    { subtotal_usd: 100, iva_usd: 8, total_usd: 108, subtotal_mxn: 0, iva_mxn: 0, total_mxn: 0 },
    { subtotal_usd: 0, iva_usd: 0, total_usd: 0, subtotal_mxn: 100, iva_mxn: 16, total_mxn: 116 },
    { subtotal_usd: 100, iva_usd: 8, total_usd: 108, subtotal_mxn: 100, iva_mxn: 16, total_mxn: 116 },
    { subtotal_usd: 0, iva_usd: 0, total_usd: 0, subtotal_mxn: 0, iva_mxn: 0, total_mxn: 0 },
  ])("el respaldo sin detalle conserva ambas monedas incluso con ceros", (totales) => {
    const { container } = render(<ProformaDocument proforma={makeProforma(totales)} embarque={embarque} conceptos={[]} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Detalle de conceptos no disponible. Se conserva el importe guardado.");
    if (totales.total_usd) expect(text).toContain("TotalUSD 108.00");
    if (totales.total_mxn) expect(text).toContain("TotalMXN 116.00");
  });

  it("redondea cantidad por precio antes del IVA y suma subtotales de filas por contenedor", () => {
    const conceptos = [fila("a", { cantidad: 0.5, precio_unitario: 2.01, embarque_contenedores: { id: "c1", numero_contenedor: "QA-A", tipo_contenedor: "40HC" } }),
      fila("b", { cantidad: 0.5, precio_unitario: 2.01, embarque_contenedores: { id: "c1", numero_contenedor: "QA-A", tipo_contenedor: "40HC" } }),
      fila("c", { precio_unitario: 10, embarque_contenedores: { id: "c2", numero_contenedor: "QA-B", tipo_contenedor: "40HC" } })];
    const { container } = render(<ProformaDocument proforma={encabezadoRedondeo} embarque={embarque} conceptos={conceptos} />);
    expect(container.textContent).toContain("Subtotal MXN: MXN 2.02");
    expect(container.textContent).toContain("SubtotalMXN 12.02IVAMXN 1.92TotalMXN 13.94");
    const columnas = columnasMXN(0.16);
    expect(columnas.find((c) => c.key === "importe")?.render?.(conceptos[0])).toBe("MXN 1.01");
    expect(columnas.find((c) => c.key === "total")?.render?.(conceptos[0])).toBe("MXN 1.17");
  });
});
