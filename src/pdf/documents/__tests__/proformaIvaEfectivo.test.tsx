/**
 * v13.823.345 — Regresión: el IVA del PDF de proformas se decide por la TASA
 * efectiva de cada fila, no por el flag `aplica_iva`, y las notas internas
 * nunca llegan al PDF.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  columnasMXN,
  columnasUSD,
  hayIvaEfectivo,
  type ConceptoVenta,
} from "../proformaConceptosColumns";
import { ProformaDocument } from "../ProformaDocument";

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

describe("hayIvaEfectivo", () => {
  it("aplica_iva=true con tasa 0 NO cuenta como IVA", () => {
    expect(hayIvaEfectivo([fila({ tasa_iva_aplicada: 0 })], 0.16)).toBe(false);
  });

  it("fila exenta (aplica_iva=false) NO cuenta como IVA", () => {
    expect(hayIvaEfectivo([fila({ aplica_iva: false })], 0.16)).toBe(false);
  });

  it("fila al 16% sí cuenta como IVA", () => {
    expect(hayIvaEfectivo([fila({})], 0.16)).toBe(true);
  });
});

describe("columnas de proforma sin IVA efectivo", () => {
  it("MXN omite columnas IVA/Total cuando no hay IVA", () => {
    const keys = columnasMXN(0.16, false).map((c) => c.key);
    expect(keys).not.toContain("iva");
    expect(keys).not.toContain("total");
  });

  it("MXN con tasa 0 explícita imprime em dash y total sin IVA", () => {
    const cols = columnasMXN(0.16, true);
    const r = fila({ tasa_iva_aplicada: 0 });
    expect(celda(cols, "iva", r)).toBe("—");
    expect(celda(cols, "total", r)).toContain("100.00");
  });

  it("USD con aplica_iva=true y tasa 0 imprime em dash", () => {
    const cols = columnasUSD(0.16, true);
    const r = fila({ moneda: "USD", tasa_iva_aplicada: 0 });
    expect(celda(cols as never, "iva", r)).toBe("—");
  });

  it("USD al 16% imprime el IVA", () => {
    const cols = columnasUSD(0.16, true);
    const r = fila({ moneda: "USD" });
    expect(celda(cols as never, "iva", r)).toContain("16.00");
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
  iva_mxn: 0,
  total_mxn: 100,
} as never;

const embarqueBase = { modo: "Marítimo", tipo: "FCL", incoterm: "FOB" } as never;

describe("notas internas en el PDF de proforma", () => {
  it("no imprime renglones internos ni el bloque cuando sólo hay internos", () => {
    const { container } = render(
      <ProformaDocument
        proforma={{ ...(proformaBase as object), notas: "[interno] QA SMOKE revisar" } as never}
        embarque={embarqueBase}
        conceptos={[fila({ tasa_iva_aplicada: 0 })]}
        tasaIva={0.16}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain("QA SMOKE");
    expect(text).not.toContain("Notas");
  });

  it("conserva las notas públicas", () => {
    const { container } = render(
      <ProformaDocument
        proforma={{ ...(proformaBase as object), notas: "Entrega en puerta\n[interno] no mostrar" } as never}
        embarque={embarqueBase}
        conceptos={[fila({})]}
        tasaIva={0.16}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Entrega en puerta");
    expect(text).not.toContain("no mostrar");
  });
});
