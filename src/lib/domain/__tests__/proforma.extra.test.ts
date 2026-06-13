import { describe, it, expect } from "vitest";
import {
  calcularTotalesProforma,
  type ConceptoVentaLite,
  type TotalesProforma,
} from "@/lib/domain/proforma";

const mkConcepto = (over: Partial<ConceptoVentaLite>): ConceptoVentaLite => ({
  id: "c1",
  cantidad: 1,
  precio_unitario: 100,
  moneda: "USD",
  aplica_iva: false,
  tasa_iva_aplicada: null,
  ...over,
});

const TASA = 0.16;

describe("proforma.extra — calcularTotalesProforma estructura", () => {
  it("devuelve todas las claves del TotalesProforma", () => {
    const r: TotalesProforma = calcularTotalesProforma([], TASA);
    expect(r).toHaveProperty("subtotal_usd");
    expect(r).toHaveProperty("iva_usd");
    expect(r).toHaveProperty("total_usd");
    expect(r).toHaveProperty("subtotal_mxn");
    expect(r).toHaveProperty("iva_mxn");
    expect(r).toHaveProperty("total_mxn");
  });

  it("lista vacía → todo ceros", () => {
    const r = calcularTotalesProforma([], TASA);
    expect(r.subtotal_usd).toBe(0);
    expect(r.iva_usd).toBe(0);
    expect(r.total_usd).toBe(0);
    expect(r.subtotal_mxn).toBe(0);
    expect(r.iva_mxn).toBe(0);
    expect(r.total_mxn).toBe(0);
  });
});

describe("proforma.extra — calcularTotalesProforma USD", () => {
  it("subtotal USD sin IVA cuando aplica_iva=false", () => {
    const r = calcularTotalesProforma([mkConcepto({ cantidad: 2, precio_unitario: 50 })], TASA);
    expect(r.subtotal_usd).toBe(100);
    expect(r.iva_usd).toBe(0);
    expect(r.total_usd).toBe(100);
  });

  it("IVA USD cuando aplica_iva=true", () => {
    const r = calcularTotalesProforma(
      [mkConcepto({ cantidad: 1, precio_unitario: 1000, aplica_iva: true })],
      TASA,
    );
    expect(r.iva_usd).toBeCloseTo(160, 5);
    expect(r.total_usd).toBeCloseTo(1160, 5);
  });

  it("tasa_iva_aplicada override en USD tiene prioridad sobre tasaIva", () => {
    const r = calcularTotalesProforma(
      [mkConcepto({ cantidad: 1, precio_unitario: 1000, aplica_iva: true, tasa_iva_aplicada: 0.08 })],
      TASA,
    );
    expect(r.iva_usd).toBeCloseTo(80, 5);
  });

  it("ivaOverridesUSD=true fuerza IVA aunque aplica_iva=false", () => {
    const c = mkConcepto({ id: "x1", cantidad: 1, precio_unitario: 500, aplica_iva: false });
    const r = calcularTotalesProforma([c], TASA, { x1: true });
    expect(r.iva_usd).toBeCloseTo(80, 5);
  });

  it("ivaOverridesUSD=false desactiva IVA aunque aplica_iva=true", () => {
    const c = mkConcepto({ id: "x2", cantidad: 1, precio_unitario: 500, aplica_iva: true });
    const r = calcularTotalesProforma([c], TASA, { x2: false });
    expect(r.iva_usd).toBe(0);
  });

  it("varios conceptos USD acumulan subtotal", () => {
    const r = calcularTotalesProforma(
      [
        mkConcepto({ id: "a", cantidad: 2, precio_unitario: 100 }),
        mkConcepto({ id: "b", cantidad: 3, precio_unitario: 50 }),
      ],
      TASA,
    );
    expect(r.subtotal_usd).toBe(350);
  });
});

describe("proforma.extra — calcularTotalesProforma MXN", () => {
  it("MXN siempre lleva IVA con tasa global", () => {
    const r = calcularTotalesProforma(
      [mkConcepto({ moneda: "MXN", cantidad: 1, precio_unitario: 1000 })],
      TASA,
    );
    expect(r.iva_mxn).toBeCloseTo(160, 5);
    expect(r.total_mxn).toBeCloseTo(1160, 5);
  });

  it("MXN con tasa_iva_aplicada 0 → iva=0", () => {
    const r = calcularTotalesProforma(
      [mkConcepto({ moneda: "MXN", cantidad: 1, precio_unitario: 500, tasa_iva_aplicada: 0 })],
      TASA,
    );
    expect(r.iva_mxn).toBe(0);
    expect(r.total_mxn).toBe(500);
  });

  it("no mezcla subtotales USD y MXN", () => {
    const r = calcularTotalesProforma(
      [
        mkConcepto({ moneda: "USD", cantidad: 1, precio_unitario: 200 }),
        mkConcepto({ moneda: "MXN", cantidad: 1, precio_unitario: 300, id: "m1" }),
      ],
      TASA,
    );
    expect(r.subtotal_usd).toBe(200);
    expect(r.subtotal_mxn).toBe(300);
  });

  it("precio_unitario como string numérico se convierte correctamente", () => {
    const r = calcularTotalesProforma(
      [mkConcepto({ moneda: "MXN", cantidad: "2" as unknown as number, precio_unitario: "100" as unknown as number })],
      TASA,
    );
    expect(r.subtotal_mxn).toBe(200);
  });
});
