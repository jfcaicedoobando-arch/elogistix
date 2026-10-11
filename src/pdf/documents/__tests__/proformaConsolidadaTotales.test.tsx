import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { makeEmbarque, makeProforma } from "@/test/fixtures";
import { ProformaConsolidadaDocument } from "../ProformaConsolidadaDocument";

type Concepto = Parameters<typeof ProformaConsolidadaDocument>[0]["conceptosConsolidados"][number];
function fila(id: string, overrides: Partial<Concepto> = {}): Concepto {
  // SAFE-CAST: snapshot sintético con todos los campos consumidos por el PDF.
  return { id, descripcion: `Servicio sintético ${id}`, cantidad: 1, precio_unitario: 1533.33,
    moneda: "MXN", aplica_iva: true, tasa_iva_aplicada: 0.16, tipo_iva: "gravado_16",
    iva: 245.3328, total: 1533.33, contenedor: "QA-A", tipo_contenedor: "40HC", ...overrides } as Concepto;
}
const embarque = makeEmbarque();
const proforma = makeProforma({ es_consolidada: true, subtotal_usd: 0, iva_usd: 0, total_usd: 0,
  subtotal_mxn: 3066.66, iva_mxn: 490.6656, total_mxn: 3557.3256 });

describe("proforma consolidada PDF: snapshot con BL-12", () => {
  it("usa base más IVA por fila y contenedor aunque total persistido sea base sin IVA", () => {
    const conceptosConsolidados = [fila("a"), fila("b")];
    const before = JSON.stringify({ proforma, conceptosConsolidados });
    const { container } = render(<ProformaConsolidadaDocument proforma={proforma} embarque={embarque} conceptosConsolidados={conceptosConsolidados} />);
    const text = container.textContent ?? "";
    expect(text.match(/MXN 1,778\.66/g)).toHaveLength(2);
    expect(text).toContain("Total del contenedor MXN: MXN 3,557.32");
    expect(text).toContain("SubtotalMXN 3,066.66IVAMXN 490.66TotalMXN 3,557.32");
    expect(text).not.toContain("3,557.33");
    expect(JSON.stringify({ proforma, conceptosConsolidados })).toBe(before);
  });

  it("usa tasa recibida, tratamientos efectivos y monedas independientes", () => {
    const conceptosConsolidados = [fila("general", { moneda: "USD", precio_unitario: 100 }),
      fila("frontera", { precio_unitario: 100, tipo_iva: "gravado_8" }),
      fila("no-objeto", { precio_unitario: 100, tipo_iva: "no_objeto", total: 999, iva: 999 })];
    const { container } = render(<ProformaConsolidadaDocument proforma={proforma} embarque={embarque} conceptosConsolidados={conceptosConsolidados} tasaIva={0.12} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Total del contenedor USD: USD 112.00");
    expect(text).toContain("Total del contenedor MXN: MXN 208.00");
    expect(text).toContain("SubtotalUSD 100.00IVAUSD 12.00TotalUSD 112.00");
    expect(text).toContain("SubtotalMXN 200.00IVAMXN 8.00TotalMXN 208.00");
    expect(text).not.toContain("999.00");
  });

  it.each([false, true])("avisa sólo cuando el legado sin clasificar causa IVA efectivo: %s", (aplica_iva) => {
    const conceptosConsolidados = [fila("legacy", { precio_unitario: 100, tipo_iva: null,
      aplica_iva, tasa_iva_aplicada: aplica_iva ? null : 0.16 })];
    const { container } = render(<ProformaConsolidadaDocument proforma={proforma} embarque={embarque} conceptosConsolidados={conceptosConsolidados} />);
    expect(container.textContent?.includes("ESTIMADO")).toBe(aplica_iva);
    expect(container.textContent).toContain(aplica_iva ? "TotalMXN 116.00" : "TotalMXN 100.00");
  });

  it("sin snapshot conserva encabezado histórico con aviso", () => {
    const { container } = render(<ProformaConsolidadaDocument proforma={proforma} embarque={embarque} conceptosConsolidados={[]} />);
    expect(container.textContent).toContain("TotalMXN 3,557.33");
    expect(container.textContent).toContain("Detalle de conceptos no disponible. Se conserva el importe guardado.");
  });
});
