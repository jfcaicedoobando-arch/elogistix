import { describe, it, expect } from "vitest";
import {
  parseConceptos,
  calcularTotalesConceptos,
  getNombreDestinatario,
} from "@/lib/parsers/cotizacionDetalle";
import type { ConceptoVentaCotizacion } from "@/types/cotizacion";

const concepto = (over: Partial<ConceptoVentaCotizacion>): ConceptoVentaCotizacion => ({
  descripcion: "Flete",
  unidad_medida: "Servicio",
  cantidad: 1,
  precio_unitario: 100,
  moneda: "USD",
  aplica_iva: false,
  total: 100,
  ...over,
});

describe("cotizacionDetalleHelpers", () => {
  describe("parseConceptos", () => {
    it("retorna array vacío para null/undefined", () => {
      expect(parseConceptos(null)).toEqual([]);
      expect(parseConceptos(undefined)).toEqual([]);
    });

    it("retorna array vacío para tipos no-array", () => {
      expect(parseConceptos({})).toEqual([]);
      expect(parseConceptos(42)).toEqual([]);
    });

    it("parsea un string JSON", () => {
      const arr = [concepto({})];
      expect(parseConceptos(JSON.stringify(arr))).toEqual(arr);
    });

    it("retorna el array tal cual si ya es array", () => {
      const arr = [concepto({}), concepto({ moneda: "MXN" })];
      expect(parseConceptos(arr)).toEqual(arr);
    });
  });

  describe("calcularTotalesConceptos", () => {
    it("separa USD y MXN correctamente", () => {
      const conceptos = [
        concepto({ moneda: "USD", total: 500 }),
        concepto({ moneda: "MXN", cantidad: 2, precio_unitario: 1000, total: 2320 }),
        concepto({ moneda: "USD", total: 300 }),
      ];
      const r = calcularTotalesConceptos(conceptos, 0.16);
      expect(r.conceptosVentaUSD).toHaveLength(2);
      expect(r.conceptosVentaMXN).toHaveLength(1);
    });

    it("suma totales USD usando el campo `total`", () => {
      const r = calcularTotalesConceptos(
        [concepto({ moneda: "USD", total: 500 }), concepto({ moneda: "USD", total: 300 })],
        0.16,
      );
      expect(r.totalUSD).toBe(800);
    });

    it("calcula subtotal MXN desde cantidad × precio", () => {
      const r = calcularTotalesConceptos(
        [concepto({ moneda: "MXN", cantidad: 3, precio_unitario: 100 })],
        0.16,
      );
      expect(r.subtotalMXN).toBe(300);
      expect(r.ivaMXN).toBeCloseTo(48, 2);
      expect(r.totalMXN).toBeCloseTo(348, 2);
    });

    it("usa la tasa de IVA proporcionada", () => {
      const r = calcularTotalesConceptos(
        [concepto({ moneda: "MXN", cantidad: 1, precio_unitario: 1000 })],
        0.08,
      );
      expect(r.ivaMXN).toBeCloseTo(80, 2);
    });

    it("retorna ceros para conceptos vacíos", () => {
      const r = calcularTotalesConceptos([], 0.16);
      expect(r.totalUSD).toBe(0);
      expect(r.totalMXN).toBe(0);
    });
  });

  describe("getNombreDestinatario", () => {
    it("retorna string vacío si no hay cotización", () => {
      expect(getNombreDestinatario(undefined)).toBe("");
    });

    it("agrega sufijo (Prospecto) cuando es prospecto", () => {
      expect(getNombreDestinatario({
        es_prospecto: true,
        prospecto_empresa: "ACME Corp",
        cliente_nombre: "",
      })).toBe("ACME Corp (Prospecto)");
    });

    it("retorna nombre del cliente cuando NO es prospecto", () => {
      expect(getNombreDestinatario({
        es_prospecto: false,
        prospecto_empresa: "",
        cliente_nombre: "Logística MX",
      })).toBe("Logística MX");
    });
  });
});
