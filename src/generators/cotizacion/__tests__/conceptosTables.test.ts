import { describe, it, expect } from "vitest";
import { splitConceptos, calcularTotales } from "../conceptosTables";
import type { ConceptoVentaCotizacion } from "@/types/cotizacion";

const mkConcepto = (moneda: string, cantidad: number, precio_unitario: number, aplica_iva = false): ConceptoVentaCotizacion => ({
  descripcion: "Test",
  unidad_medida: "UNI",
  cantidad,
  precio_unitario,
  moneda,
  total: cantidad * precio_unitario,
  aplica_iva,
});

describe("splitConceptos", () => {
  it("separa correctamente USD y MXN", () => {
    const conceptos = [mkConcepto("USD", 2, 100), mkConcepto("MXN", 3, 50), mkConcepto("USD", 1, 200)];
    const { usd, mxn } = splitConceptos(conceptos);
    expect(usd).toHaveLength(2);
    expect(mxn).toHaveLength(1);
  });

  it("retorna arrays vacíos si no hay conceptos", () => {
    const { usd, mxn } = splitConceptos([]);
    expect(usd).toHaveLength(0);
    expect(mxn).toHaveLength(0);
  });
});

describe("calcularTotales", () => {
  it("calcula subtotales por moneda correctamente", () => {
    const conceptos = [
      mkConcepto("USD", 2, 100),  // 200 USD sin IVA
      mkConcepto("MXN", 4, 50),   // 200 MXN
    ];
    const totales = calcularTotales(conceptos);
    expect(totales.subtotalUSD).toBe(200);
    expect(totales.subtotalMXN).toBe(200);
    expect(totales.ivaUSD).toBe(0); // aplica_iva=false
    expect(totales.ivaMXN).toBeGreaterThan(0); // IVA sobre MXN siempre
  });

  it("aplica IVA en USD solo cuando aplica_iva=true", () => {
    const conceptos = [mkConcepto("USD", 1, 1000, true)];
    const totales = calcularTotales(conceptos);
    expect(totales.ivaUSD).toBeCloseTo(160, 1);
    expect(totales.totalUSD).toBeCloseTo(1160, 1);
  });

  it("retorna ceros con lista vacía", () => {
    const totales = calcularTotales([]);
    expect(totales.subtotalUSD).toBe(0);
    expect(totales.subtotalMXN).toBe(0);
    expect(totales.totalUSD).toBe(0);
    expect(totales.totalMXN).toBe(0);
  });
});
