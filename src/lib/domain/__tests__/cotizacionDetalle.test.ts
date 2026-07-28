import { describe, it, expect, vi } from "vitest";
import {
  parseConceptos,
  calcularTotalesConceptos,
  getNombreDestinatario,
  EMPTY_TOTALES,
} from "@/lib/domain/cotizacionDetalle";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";

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

    it("retorna [] y loggea ante JSON string inválido", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(parseConceptos("{not json")).toEqual([]);
        expect(warn).toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it("descarta filas con schema inválido (moneda desconocida o campos faltantes)", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const mixed = [
          concepto({ moneda: "USD" }),
          { moneda: "EUR", cantidad: 1, precio_unitario: 10 },
          { moneda: "USD", precio_unitario: 10 },
          { foo: "bar" },
          null,
        ];
        const r = parseConceptos(mixed);
        expect(r).toHaveLength(1);
        expect(warn).toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
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
        [concepto({ moneda: "MXN", cantidad: 3, precio_unitario: 100, aplica_iva: true })],
        0.16,
      );
      expect(r.subtotalMXN).toBe(300);
      expect(r.ivaMXN).toBeCloseTo(48, 2);
      expect(r.totalMXN).toBeCloseTo(348, 2);
    });

    it("usa la tasa de IVA proporcionada", () => {
      const r = calcularTotalesConceptos(
        [concepto({ moneda: "MXN", cantidad: 1, precio_unitario: 1000, aplica_iva: true })],
        0.08,
      );
      expect(r.ivaMXN).toBeCloseTo(80, 2);
    });

    it("retorna ceros para conceptos vacíos", () => {
      const r = calcularTotalesConceptos([], 0.16);
      expect(r.totalUSD).toBe(0);
      expect(r.totalMXN).toBe(0);
    });

    it("retorna la MISMA referencia (EMPTY_TOTALES) para arrays vacíos → memos estables", () => {
      const a = calcularTotalesConceptos([], 0.16);
      const b = calcularTotalesConceptos([], 0.08);
      expect(a).toBe(EMPTY_TOTALES);
      expect(b).toBe(EMPTY_TOTALES);
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
