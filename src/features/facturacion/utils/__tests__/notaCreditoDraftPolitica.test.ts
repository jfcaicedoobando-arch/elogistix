/**
 * Política pura del borrador de NC: derivados, validación y construcción del
 * input. Sin React ni red.
 */
import { describe, it, expect } from "vitest";
import {
  makeConcepto,
  draftInicialNC,
  derivadosNC,
  construirInputNC,
  normalizarTipoCambioNC,
  MSG_TC_NO_DISPONIBLE,
  type DraftNC,
} from "../notaCreditoDraftPolitica";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";

const conceptoOk: ConceptoNotaCredito = {
  descripcion: "Servicio",
  cantidad: 1,
  precio_unitario: 500,
  clave_sat: "84111506",
  clave_unidad: "E48",
  unidad: "u",
  tasa_iva: 0.16,
  tipo_iva: "gravado_16",
};

function draft(over: Partial<DraftNC> = {}): DraftNC {
  return {
    ...draftInicialNC({ formaPago: "15" }),
    descripcion: "Descuento comercial",
    conceptos: [conceptoOk],
    ...over,
  };
}

const ctx = { saldoFactura: 10_000, uuidFacturaOriginal: "UUID-1" };

describe("notaCreditoDraftPolitica · derivados", () => {
  it("draft válido puede guardarse y timbrarse", () => {
    const d = derivadosNC(draft(), ctx);
    expect(d.monto).toBe(580);
    expect(d.saldoRestante).toBe(9420);
    expect(d.puedeGuardar).toBe(true);
    expect(d.puedeTimbrar).toBe(true);
    expect(d.faltantesGuardar).toEqual([]);
  });

  it("sin descripción o con conceptos inválidos no puede guardarse", () => {
    const sinDesc = derivadosNC(draft({ descripcion: "   " }), ctx);
    expect(sinDesc.puedeGuardar).toBe(false);
    expect(sinDesc.faltantesGuardar).toContain("descripción");

    const malos = derivadosNC(draft({ conceptos: [{ ...conceptoOk, descripcion: "" }] }), ctx);
    expect(malos.puedeGuardar).toBe(false);
    expect(malos.faltantesGuardar).toContain(
      "conceptos completos (descripción, cantidad y precio)",
    );
  });

  it("IVA indeterminado bloquea y lo explica (no se infiere 16%)", () => {
    const d = derivadosNC(
      draft({ conceptos: [{ ...makeConcepto(), descripcion: "x", precio_unitario: 100 }] }),
      ctx,
    );
    expect(d.tratamientoIndefinido).toBe(true);
    expect(d.puedeGuardar).toBe(false);
    expect(d.faltantesGuardar).toContain("tratamiento fiscal de IVA definido en cada concepto");
  });

  it("monto mayor al saldo marca exceso", () => {
    const d = derivadosNC(draft(), { ...ctx, saldoFactura: 100 });
    expect(d.excedeSaldo).toBe(true);
    expect(d.faltantesGuardar).toContain("monto dentro del saldo de la factura");
  });

  it("factura liquidada bloquea la NC", () => {
    const d = derivadosNC(draft(), { ...ctx, saldoFactura: 0 });
    expect(d.facturaLiquidada).toBe(true);
    expect(d.puedeGuardar).toBe(false);
    expect(d.faltantesGuardar).toContain("factura con saldo pendiente");
  });

  it("sin UUID permite guardar pero no timbrar", () => {
    const d = derivadosNC(draft(), { ...ctx, uuidFacturaOriginal: null });
    expect(d.puedeGuardar).toBe(true);
    expect(d.puedeTimbrar).toBe(false);
    expect(d.faltantesTimbrar).toEqual(["UUID fiscal de la factura original"]);
  });

  it("isDirty sólo con captura real", () => {
    expect(derivadosNC(draftInicialNC({ formaPago: "15" }), ctx).isDirty).toBe(false);
    expect(derivadosNC(draft(), ctx).isDirty).toBe(true);
  });
});

describe("notaCreditoDraftPolitica · tipo de cambio e input", () => {
  it("MXN usa TC = 1 aunque llegue 0", () => {
    expect(normalizarTipoCambioNC("MXN", 0)).toBe(1);
    const input = construirInputNC({
      draft: draft(),
      facturaId: "fact-1",
      monedaFactura: "MXN",
      tipoCambioFactura: 0,
      monto: 580,
    });
    expect(input.tipo_cambio).toBe(1);
    expect(input.uso_cfdi).toBe("G02");
    expect(input.descripcion).toBe("Descuento comercial");
  });

  it("moneda extranjera exige TC finito > 0", () => {
    expect(() => normalizarTipoCambioNC("USD", 0)).toThrow(MSG_TC_NO_DISPONIBLE);
    expect(() => normalizarTipoCambioNC("USD", Number.NaN)).toThrow("LC_TC_NO_DISPONIBLE");
    expect(normalizarTipoCambioNC("USD", 17.5)).toBe(17.5);
  });
});
