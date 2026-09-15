/**
 * MNY-01 — un depósito de cliente que cubre varias facturas (cobro en lote)
 * debe abrir su detalle desde la conciliación bancaria.
 */
import { describe, it, expect } from "vitest";
import {
  refPagoDeMovimiento,
  TIPO_PAGO_DETALLE_LABELS,
} from "@/features/tesoreria/domain/pagoDetalle";

describe("refPagoDeMovimiento · cobro en lote (MNY-01)", () => {
  it("resuelve pago_factura_lote_id como lote de cobro", () => {
    expect(refPagoDeMovimiento({ pago_factura_lote_id: "lc" })).toEqual({
      tipo: "lote_cobro",
      id: "lc",
    });
  });

  it("el lote de proveedor conserva la precedencia", () => {
    expect(
      refPagoDeMovimiento({ pago_proveedor_lote_id: "lp", pago_factura_lote_id: "lc" }),
    ).toEqual({ tipo: "lote", id: "lp" });
  });

  it("el lote de cobro gana sobre el cobro individual", () => {
    expect(refPagoDeMovimiento({ pago_factura_lote_id: "lc", pago_factura_id: "pf" })).toEqual({
      tipo: "lote_cobro",
      id: "lc",
    });
  });

  it("tiene etiqueta en español", () => {
    expect(TIPO_PAGO_DETALLE_LABELS.lote_cobro).toBe("Cobro en lote de cliente");
  });
});
