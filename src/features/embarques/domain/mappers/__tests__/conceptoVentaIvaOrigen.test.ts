/**
 * R179-01 — Regresiones del tratamiento fiscal de las líneas de venta del
 * wizard de embarques: lo que se elige en el catálogo debe llegar al payload y
 * producir los mismos totales en vista previa / confirmación / PDF.
 *
 * Preparadas para GitHub Actions (no se ejecutan localmente).
 */
import { describe, it, expect } from "vitest";
import { buildConceptosVentaPayload } from "@/features/embarques/domain/mappers/embarqueToDbConceptos";
import { calcularTotalesProforma } from "@/features/proformas/domain";
import type { ConceptoVentaLocal } from "@/types/concepto";

const TASA_GLOBAL = 0.16;

function fila(extra: Partial<ConceptoVentaLocal> = {}): ConceptoVentaLocal {
  return {
    id: 1,
    concepto: "Flete",
    cantidad: 1,
    precioUnitario: 100,
    moneda: "MXN",
    contenedorId: null,
    ...extra,
  };
}

describe("payload de conceptos de venta — tratamiento fiscal", () => {
  it("conserva el IVA 16% elegido en el catálogo", () => {
    const [p] = buildConceptosVentaPayload([fila({ aplicaIva: true, tasaIva: 0.16 })]);
    expect(p.aplica_iva).toBe(true);
    expect(p.tasa_iva_aplicada).toBe(0.16);
  });

  it("conserva un producto de tasa 0% (no lo grava por ser MXN)", () => {
    const [p] = buildConceptosVentaPayload([fila({ aplicaIva: false, tasaIva: 0 })]);
    expect(p.aplica_iva).toBe(false);
    expect(p.tasa_iva_aplicada).toBe(0);
  });

  it("omite las claves fiscales cuando la fila no las define (no toca lo guardado)", () => {
    const [p] = buildConceptosVentaPayload([fila()]);
    expect("aplica_iva" in p).toBe(false);
    expect("tasa_iva_aplicada" in p).toBe(false);
  });

  it("preserva una tasa explícita de 8% existente", () => {
    const [p] = buildConceptosVentaPayload([
      fila({ dbId: "c-1", aplicaIva: true, tasaIva: 0.08 }),
    ]);
    expect(p.id).toBe("c-1");
    expect(p.tasa_iva_aplicada).toBe(0.08);
  });
});

describe("totales de proforma coherentes con la configuración fiscal", () => {
  const concepto = (aplica: boolean, tasa: number) => ({
    id: "x",
    cantidad: 1,
    precio_unitario: 100,
    moneda: "MXN",
    aplica_iva: aplica,
    tasa_iva_aplicada: tasa,
  });

  it("subtotal 100 con catálogo 16% ⇒ total 116", () => {
    const t = calcularTotalesProforma([concepto(true, 0.16)], TASA_GLOBAL);
    expect(t.iva_mxn).toBe(16);
    expect(t.total_mxn).toBe(116);
  });

  it("subtotal 100 con catálogo 0% ⇒ total 100", () => {
    const t = calcularTotalesProforma([concepto(false, 0)], TASA_GLOBAL);
    expect(t.iva_mxn).toBe(0);
    expect(t.total_mxn).toBe(100);
  });

  it("tasa explícita 8% se respeta frente a la tasa global", () => {
    const t = calcularTotalesProforma([concepto(true, 0.08)], TASA_GLOBAL);
    expect(t.iva_mxn).toBe(8);
    expect(t.total_mxn).toBe(108);
  });

  it("mantiene el override USD del modal", () => {
    const usd = { ...concepto(true, 0.16), id: "u", moneda: "USD" };
    expect(calcularTotalesProforma([usd], TASA_GLOBAL, { u: false }).total_usd).toBe(100);
    expect(calcularTotalesProforma([usd], TASA_GLOBAL, { u: true }).total_usd).toBe(116);
  });
});
