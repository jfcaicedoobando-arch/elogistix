import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { columnasMXN, columnasUSD, type ConceptoVenta } from "../proformaConceptosColumns";
import { ProformaDocument } from "../ProformaDocument";
import { ProformaConsolidadaDocument } from "../ProformaConsolidadaDocument";

function fila(over: Partial<ConceptoVenta>): ConceptoVenta {
  return {
    id: "c1",
    descripcion: "Flete",
    cantidad: 1,
    precio_unitario: 100,
    moneda: "MXN",
    aplica_iva: true,
    tasa_iva_aplicada: 0.16,
    ...over,
  } as ConceptoVenta;
}

function celda(cols: ReturnType<typeof columnasMXN>, key: string, r: ConceptoVenta): string {
  const col = cols.find((c) => c.key === key)!;
  return String(col.render!(r));
}

describe("R179-01/PDF-A — semántica fiscal de las columnas del PDF", () => {
  it("MXN con aplica_iva=false y tasa 0.16 heredada: IVA 0 y total 100", () => {
    const cols = columnasMXN(0.16);
    const r = fila({ aplica_iva: false, tasa_iva_aplicada: 0.16 });
    expect(celda(cols, "iva", r)).toContain("0.00");
    expect(celda(cols, "total", r)).toContain("100.00");
  });

  it("MXN gravado al 8%: IVA 8 y total 108", () => {
    const cols = columnasMXN(0.16);
    const r = fila({ aplica_iva: true, tasa_iva_aplicada: 0.08 });
    expect(celda(cols, "iva", r)).toContain("8.00");
    expect(celda(cols, "total", r)).toContain("108.00");
  });

  it("MXN gravado al 16%: IVA 16 y total 116", () => {
    const cols = columnasMXN(0.16);
    const r = fila({ aplica_iva: true, tasa_iva_aplicada: 0.16 });
    expect(celda(cols, "iva", r)).toContain("16.00");
    expect(celda(cols, "total", r)).toContain("116.00");
  });

  it("USD exento muestra guion y total sin IVA", () => {
    const cols = columnasUSD(0.16, true);
    const r = fila({ moneda: "USD", aplica_iva: false, tasa_iva_aplicada: 0.16 });
    expect(celda(cols as never, "iva", r)).toBe("—");
    expect(celda(cols as never, "total", r)).toContain("100.00");
  });
});

const proformaBase = {
  numero: "PROF-001",
  fecha_emision: "2026-09-07",
  expediente: "EXP-1",
  cliente_nombre: "Cliente",
  subtotal_usd: 0,
  iva_usd: 0,
  total_usd: 0,
  subtotal_mxn: 100,
  iva_mxn: 8,
  total_mxn: 108,
} as never;

const embarqueBase = { modo: "Marítimo", tipo: "FCL", incoterm: "FOB" } as never;

describe("R179-01/PDF-B — etiqueta de IVA en la caja de totales", () => {
  it("no rotula la tasa global en la proforma simple", () => {
    const { container } = render(
      <ProformaDocument
        proforma={proformaBase}
        embarque={embarqueBase}
        conceptos={[fila({ tasa_iva_aplicada: 0.08 })]}
        tasaIva={0.16}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("IVA MXN");
    expect(text).not.toContain("IVA (16%)");
  });

  it("no rotula la tasa global en la proforma consolidada", () => {
    const { container } = render(
      <ProformaConsolidadaDocument
        proforma={proformaBase}
        embarque={embarqueBase}
        conceptosConsolidados={[
          {
            id: "x",
            descripcion: "Flete",
            cantidad: 1,
            precio_unitario: 100,
            subtotal: 100,
            iva: 8,
            total: 108,
            moneda: "MXN",
            aplica_iva: true,
            contenedor: "MSCU-1",
            tipo_contenedor: "40HC",
          } as never,
        ]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain("IVA (16%)");
    // R183-PDF-01: el renglón del grupo suma totales con IVA → se rotula "Total".
    expect(text).toContain("Total del contenedor MXN");
    expect(text).not.toContain("Subtotal MXN:");
  });
});
