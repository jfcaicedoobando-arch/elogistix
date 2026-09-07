import { describe, it, expect } from "vitest";
import { esConceptoElegibleProforma } from "../conceptoElegibleProforma";
import { ivaDeFila, etiquetaIvaFilas } from "../ivaConceptoVenta";
import { buildInitialProformaState, calcularTotalesProforma } from "@/features/embarques/hooks/useDialogGenerarProformaController.helpers";
import type { Tables } from "@/integrations/supabase/types";

type ConceptoVenta = Tables<"conceptos_venta">;

function fila(over: Partial<ConceptoVenta>): ConceptoVenta {
  return {
    id: "c1", cantidad: 1, precio_unitario: 100, moneda: "MXN",
    aplica_iva: false, tasa_iva_aplicada: 0.16,
    estado_facturacion: "pendiente", proforma_id: null,
    ...over,
  } as ConceptoVenta;
}

describe("R179-02 · elegibilidad de conceptos para proforma", () => {
  it("acepta sólo pendientes sin vínculo a proforma", () => {
    expect(esConceptoElegibleProforma({ estado_facturacion: "pendiente", proforma_id: null })).toBe(true);
    expect(esConceptoElegibleProforma({ estado_facturacion: "pendiente", proforma_id: "p1" })).toBe(false);
    expect(esConceptoElegibleProforma({ estado_facturacion: "facturado", proforma_id: null })).toBe(false);
    expect(esConceptoElegibleProforma({ estado_facturacion: "en_proforma", proforma_id: "p1" })).toBe(false);
  });
});

describe("R179-01 · IVA coherente entre modal y guardado", () => {
  it("no grava un concepto MXN guardado sin IVA", () => {
    const c = fila({ aplica_iva: false });
    expect(ivaDeFila(c)).toBe(false);
    const totales = calcularTotalesProforma([c], { c1: true }, 0.16);
    expect(totales.iva_mxn).toBe(0);
    expect(totales.total_mxn).toBe(100);
  });

  it("respeta la tasa explícita de la fila MXN gravada", () => {
    const c = fila({ aplica_iva: true, tasa_iva_aplicada: 0.08 });
    const totales = calcularTotalesProforma([c], {}, 0.16);
    expect(totales.iva_mxn).toBe(8);
    expect(etiquetaIvaFilas([c], 0.16)).toBe("8%");
  });

  it("etiqueta 0% cuando ninguna fila causa IVA", () => {
    expect(etiquetaIvaFilas([fila({ aplica_iva: false })], 0.16)).toBe("0%");
  });

  it("el estado inicial no fuerza IVA por moneda", () => {
    const init = buildInitialProformaState([fila({ aplica_iva: false })], "todos");
    expect(init.ivaPorConcepto.c1).toBe(false);
  });

  it("USD conserva el toggle del usuario", () => {
    const c = fila({ id: "u1", moneda: "USD", aplica_iva: false, tasa_iva_aplicada: 0.16 });
    expect(calcularTotalesProforma([c], { u1: true }, 0.16).iva_usd).toBe(16);
    expect(calcularTotalesProforma([c], { u1: false }, 0.16).iva_usd).toBe(0);
  });
});
