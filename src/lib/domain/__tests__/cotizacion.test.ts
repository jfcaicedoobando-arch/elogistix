import { describe, it, expect } from "vitest";
import { buildConceptosFromCostos } from "@/lib/domain/cotizacion";
import type { FilaCostoLocal } from "@/types/cotizacionPLTypes";

const TASA = 0.16;

const fila = (over: Partial<FilaCostoLocal>): FilaCostoLocal => ({
  concepto: "Flete Marítimo",
  moneda: "USD",
  proveedor: "",
  cantidad: 1,
  costo_unitario: 100,
  precio_venta: 200,
  unidad_medida: "Contenedor",
  ...over,
});

describe("buildConceptosFromCostos", () => {
  it("descarta conceptos con descripción vacía", () => {
    const out = buildConceptosFromCostos([fila({ concepto: "  " })], TASA);
    expect(out.usd).toHaveLength(0);
    expect(out.mxn).toHaveLength(0);
  });

  it("separa por moneda", () => {
    const out = buildConceptosFromCostos(
      [fila({ moneda: "USD" }), fila({ moneda: "MXN", concepto: "Maniobras" })],
      TASA,
    );
    expect(out.usd).toHaveLength(1);
    expect(out.mxn).toHaveLength(1);
    expect(out.usd[0].moneda).toBe("USD");
    expect(out.mxn[0].moneda).toBe("MXN");
  });

  it("aplica IVA siempre a MXN", () => {
    const out = buildConceptosFromCostos(
      [fila({ moneda: "MXN", concepto: "Maniobras", precio_venta: 1000, cantidad: 1 })],
      TASA,
    );
    expect(out.mxn[0].aplica_iva).toBe(true);
    expect(out.mxn[0].total).toBeCloseTo(1160, 2);
  });

  it("USD sin IVA si el concepto no está en CONCEPTOS_CON_IVA_USD", () => {
    const out = buildConceptosFromCostos(
      [fila({ moneda: "USD", concepto: "Flete Marítimo", precio_venta: 100, cantidad: 2 })],
      TASA,
    );
    expect(out.usd[0].aplica_iva).toBe(false);
    expect(out.usd[0].total).toBe(200);
  });

  it("USD con IVA si el concepto está en CONCEPTOS_CON_IVA_USD (Seguro)", () => {
    const out = buildConceptosFromCostos(
      [fila({ moneda: "USD", concepto: "Seguro", precio_venta: 100, cantidad: 1 })],
      TASA,
    );
    expect(out.usd[0].aplica_iva).toBe(true);
    expect(out.usd[0].total).toBeCloseTo(116, 2);
  });

  it("preserva unidad_medida y cantidad en la salida", () => {
    const out = buildConceptosFromCostos(
      [fila({ moneda: "USD", concepto: "Flete Marítimo", unidad_medida: "BL", cantidad: 3 })],
      TASA,
    );
    expect(out.usd[0].unidad_medida).toBe("BL");
    expect(out.usd[0].cantidad).toBe(3);
  });
});
