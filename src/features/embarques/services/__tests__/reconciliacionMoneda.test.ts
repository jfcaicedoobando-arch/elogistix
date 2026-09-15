/**
 * MNY-NEW-03 — la conciliación de costos nunca compara divisas distintas 1:1.
 */
import { describe, it, expect } from "vitest";
import {
  buildFilasReconciliacion,
  convertirMontoVinculo,
  type CCRow,
  type PFCRow,
} from "../reconciliacionCostos.helpers";

const concepto = (moneda: string, monto: number): CCRow => ({
  id: "cc-1",
  concepto: "Flete marítimo",
  proveedor_nombre: "Naviera SA",
  moneda,
  monto,
  estado_liquidacion: "Pendiente",
});

const vinculo = (
  monto: number,
  moneda: string | null,
  tc: number | null,
): PFCRow => ({
  monto,
  concepto_costo_id: "cc-1",
  descripcion: "Flete",
  proveedor_facturas: {
    id: "pf-1",
    folio_interno: "FP-000001",
    folio_proveedor: "A-1",
    fecha_emision: "2026-01-10",
    fecha_vencimiento: "2026-02-10",
    estado: "Registrada",
    moneda,
    tipo_cambio_usd: tc,
    deleted_at: null,
  },
});

describe("convertirMontoVinculo", () => {
  it("misma moneda: monto tal cual", () => {
    expect(convertirMontoVinculo(872.61, "MXN", "MXN", null)).toBe(872.61);
  });

  it("USD→MXN y MXN→USD con tipo de cambio", () => {
    expect(convertirMontoVinculo(100, "USD", "MXN", 17)).toBe(1700);
    expect(convertirMontoVinculo(1700, "MXN", "USD", 17)).toBe(100);
  });

  it("sin tipo de cambio o moneda desconocida: null", () => {
    expect(convertirMontoVinculo(100, "USD", "MXN", null)).toBeNull();
    expect(convertirMontoVinculo(100, "EUR", "MXN", 17)).toBeNull();
    expect(convertirMontoVinculo(100, null, "MXN", 17)).toBeNull();
  });
});

describe("buildFilasReconciliacion · moneda", () => {
  it("convierte la factura USD antes de comparar contra un costo en MXN", () => {
    const [fila] = buildFilasReconciliacion(
      [concepto("MXN", 1700)],
      [vinculo(100, "USD", 17)],
    );
    expect(fila.real_facturado).toBe(1700);
    expect(fila.estatus_renglon).toBe("conciliado");
    expect(fila.vinculos_excluidos).toBe(0);
    expect(fila.facturas[0].monto_original).toBe(100);
  });

  it("excluye el vínculo cuando falta el tipo de cambio (no compara 1:1)", () => {
    const [fila] = buildFilasReconciliacion(
      [concepto("MXN", 872.61)],
      [vinculo(872.61, "USD", null)],
    );
    expect(fila.real_facturado).toBe(0);
    expect(fila.vinculos_excluidos).toBe(1);
    expect(fila.estatus_renglon).toBe("sin_match");
    expect(fila.facturas[0].excluida).toBe(true);
    expect(fila.facturas[0].motivo_exclusion).toContain("tipo de cambio");
  });
});
