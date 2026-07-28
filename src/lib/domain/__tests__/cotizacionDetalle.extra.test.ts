import { describe, it, expect } from "vitest";
import {
  parseConceptos,
  calcularTotalesConceptos,
  getNombreDestinatario,
  EMPTY_TOTALES,
} from "@/lib/domain/cotizacionDetalle";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types/core";

const makeConcepto = (overrides: Partial<ConceptoVentaCotizacion> = {}): ConceptoVentaCotizacion => ({
  descripcion: "Flete",
  unidad_medida: "PZA",
  cantidad: 1,
  precio_unitario: 100,
  moneda: "USD",
  total: 100,
  aplica_iva: false,
  ...overrides,
});

describe("cotizacionDetalle | parseConceptos", () => {
  it("retorna [] para null", () => {
    expect(parseConceptos(null)).toEqual([]);
  });

  it("retorna [] para undefined", () => {
    expect(parseConceptos(undefined)).toEqual([]);
  });

  it("parsea un string JSON válido con un array", () => {
    const concepto = makeConcepto();
    const result = parseConceptos(JSON.stringify([concepto]));
    expect(result).toHaveLength(1);
    expect(result[0].moneda).toBe("USD");
  });

  it("retorna [] para un string JSON malformado", () => {
    expect(parseConceptos("{broken")).toEqual([]);
  });

  it("retorna [] cuando el JSON no es un array", () => {
    expect(parseConceptos(JSON.stringify({ moneda: "USD" }))).toEqual([]);
  });

  it("descarta conceptos con moneda inválida (EUR no aceptado)", () => {
    const invalid = { ...makeConcepto(), moneda: "EUR" };
    const result = parseConceptos([invalid]);
    expect(result).toHaveLength(0);
  });

  it("descarta conceptos sin cantidad numérica", () => {
    const invalid = { ...makeConcepto(), cantidad: "uno" as unknown as number };
    const result = parseConceptos([invalid]);
    expect(result).toHaveLength(0);
  });

  it("acepta conceptos MXN válidos", () => {
    const mxn = makeConcepto({ moneda: "MXN" });
    const result = parseConceptos([mxn]);
    expect(result).toHaveLength(1);
  });

  it("filtra mezcla de válidos e inválidos", () => {
    const valid = makeConcepto({ moneda: "USD" });
    const invalid = { descripcion: "roto" };
    const result = parseConceptos([valid, invalid]);
    expect(result).toHaveLength(1);
  });

  it("procesa un array con múltiples conceptos válidos", () => {
    const items = [makeConcepto({ moneda: "USD" }), makeConcepto({ moneda: "MXN" }), makeConcepto({ moneda: "USD" })];
    expect(parseConceptos(items)).toHaveLength(3);
  });

  it("retorna [] cuando precio_unitario es Infinity", () => {
    const invalid = { ...makeConcepto(), precio_unitario: Infinity };
    expect(parseConceptos([invalid])).toHaveLength(0);
  });
});

describe("cotizacionDetalle | calcularTotalesConceptos", () => {
  it("retorna EMPTY_TOTALES para array vacío", () => {
    expect(calcularTotalesConceptos([], 0.16)).toEqual(EMPTY_TOTALES);
  });

  it("separa conceptos USD y MXN correctamente", () => {
    const usd = makeConcepto({ moneda: "USD", total: 200 });
    const mxn = makeConcepto({ moneda: "MXN", total: 1000 });
    const result = calcularTotalesConceptos([usd, mxn], 0.16);
    expect(result.conceptosVentaUSD).toHaveLength(1);
    expect(result.conceptosVentaMXN).toHaveLength(1);
  });

  it("calcula totalMXN = subtotalMXN + ivaMXN", () => {
    const mxn = makeConcepto({ moneda: "MXN", cantidad: 1, precio_unitario: 100, total: 100 });
    const result = calcularTotalesConceptos([mxn], 0.16);
    expect(result.totalMXN).toBeCloseTo(result.subtotalMXN + result.ivaMXN, 5);
  });

  it("totalUSD refleja la suma de todos los campos total USD", () => {
    const items = [
      makeConcepto({ moneda: "USD", total: 300 }),
      makeConcepto({ moneda: "USD", total: 200 }),
    ];
    const result = calcularTotalesConceptos(items, 0.16);
    expect(result.totalUSD).toBeCloseTo(500, 5);
  });

  it("retorna EMPTY_TOTALES para input no-array", () => {
    expect(calcularTotalesConceptos(null as unknown as ConceptoVentaCotizacion[], 0.16)).toEqual(EMPTY_TOTALES);
  });
});

describe("cotizacionDetalle | getNombreDestinatario", () => {
  it("retorna '' para undefined", () => {
    expect(getNombreDestinatario(undefined)).toBe("");
  });

  it("retorna el nombre del cliente cuando no es prospecto", () => {
    const cot = { es_prospecto: false, prospecto_empresa: "", cliente_nombre: "ACME SA" };
    expect(getNombreDestinatario(cot)).toBe("ACME SA");
  });

  it("retorna empresa + '(Prospecto)' cuando es prospecto", () => {
    const cot = { es_prospecto: true, prospecto_empresa: "GlobalTrade", cliente_nombre: "" };
    expect(getNombreDestinatario(cot)).toBe("GlobalTrade (Prospecto)");
  });

  it("ignora cliente_nombre cuando es prospecto", () => {
    const cot = { es_prospecto: true, prospecto_empresa: "Mi Empresa", cliente_nombre: "Otro" };
    expect(getNombreDestinatario(cot)).not.toContain("Otro");
  });
});
