import { describe, it, expect } from "vitest";
import { splitConceptos, calcularTotales } from "../conceptosTables";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";

const mkConcepto = (
  moneda: string,
  cantidad: number,
  precio_unitario: number,
  aplica_iva = false,
  tasa_iva_aplicada?: number,
): ConceptoVentaCotizacion => ({
  descripcion: "Test",
  unidad_medida: "UNI",
  cantidad,
  precio_unitario,
  moneda,
  total: cantidad * precio_unitario,
  aplica_iva,
  ...(tasa_iva_aplicada !== undefined ? { tasa_iva_aplicada } : {}),
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
      mkConcepto("USD", 2, 100),
      mkConcepto("MXN", 4, 50, true, 0.16),
    ];
    const totales = calcularTotales(conceptos, 0.16);
    expect(totales.subtotalUSD).toBe(200);
    expect(totales.subtotalMXN).toBe(200);
    expect(totales.ivaUSD).toBe(0);
    expect(totales.ivaMXN).toBeCloseTo(32, 2);
  });

  it("aplica IVA en USD según tasa_iva_aplicada de la fila", () => {
    const conceptos = [mkConcepto("USD", 1, 1000, true, 0.16)];
    const totales = calcularTotales(conceptos, 0.16);
    expect(totales.ivaUSD).toBeCloseTo(160, 1);
    expect(totales.totalUSD).toBeCloseTo(1160, 1);
  });

  it("respeta tasa 0% explícita (exento, flete marítimo internacional)", () => {
    const conceptos = [mkConcepto("USD", 1, 1000, false, 0)];
    const totales = calcularTotales(conceptos, 0.16);
    expect(totales.ivaUSD).toBe(0);
    expect(totales.totalUSD).toBe(1000);
  });

  it("respeta tasa 8% explícita (frontera)", () => {
    const conceptos = [mkConcepto("MXN", 1, 1000, true, 0.08)];
    const totales = calcularTotales(conceptos, 0.16);
    expect(totales.ivaMXN).toBeCloseTo(80, 2);
    expect(totales.totalMXN).toBeCloseTo(1080, 2);
  });

  it("retorna ceros con lista vacía", () => {
    const totales = calcularTotales([], 0.16);
    expect(totales.subtotalUSD).toBe(0);
    expect(totales.subtotalMXN).toBe(0);
    expect(totales.totalUSD).toBe(0);
    expect(totales.totalMXN).toBe(0);
  });
});
