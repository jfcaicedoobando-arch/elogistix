/**
 * P1-IVA — El atajo "por el saldo completo" no colapsa tratamientos mixtos.
 */
import { describe, it, expect } from "vitest";
import {
  conceptosPorSaldoCompleto,
  MOTIVO_SALDO_INVALIDO,
  MOTIVO_TRATAMIENTO_INDEFINIDO,
} from "../saldoCompletoNC";
import { calcularTotalesNC } from "../notaCreditoTotales";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";

const base: ConceptoNotaCredito = {
  descripcion: "Flete marítimo",
  cantidad: 1,
  precio_unitario: 1000,
  clave_sat: "84111506",
  clave_unidad: "E48",
  unidad: "Unidad de servicio",
  tasa_iva: 0.16,
  tipo_iva: "gravado_16",
};

describe("conceptosPorSaldoCompleto", () => {
  it("factura homogénea al 16%: un renglón que iguala el saldo", () => {
    const r = conceptosPorSaldoCompleto(1160, [base], base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conceptos).toHaveLength(1);
    expect(r.conceptos[0].tipo_iva).toBe("gravado_16");
    expect(calcularTotalesNC(r.conceptos).total).toBeCloseTo(1160, 2);
  });

  it("factura exenta: el renglón conserva exento (antes lo gravaba al 16%)", () => {
    const exento = { ...base, tipo_iva: "exento" as const, tasa_iva: null };
    const r = conceptosPorSaldoCompleto(1000, [exento], exento);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conceptos[0].tipo_iva).toBe("exento");
    expect(r.conceptos[0].precio_unitario).toBe(1000);
    expect(calcularTotalesNC(r.conceptos).total).toBe(1000);
  });

  it("factura no objeto: no se traslada IVA", () => {
    const noObjeto = { ...base, tipo_iva: "no_objeto" as const, tasa_iva: null };
    const r = conceptosPorSaldoCompleto(500, [noObjeto], noObjeto);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(calcularTotalesNC(r.conceptos)).toMatchObject({ iva: 0, total: 500 });
  });

  it("factura mixta: un renglón por tratamiento y el total iguala el saldo", () => {
    const mixta: ConceptoNotaCredito[] = [
      base,
      { ...base, descripcion: "Maniobras", tipo_iva: "exento", tasa_iva: null },
      { ...base, descripcion: "Frontera", tipo_iva: "gravado_8", tasa_iva: 0.08 },
    ];
    const saldo = calcularTotalesNC(mixta).total / 2;
    const r = conceptosPorSaldoCompleto(saldo, mixta, base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conceptos).toHaveLength(3);
    expect(r.conceptos.map((c) => c.tipo_iva)).toEqual(["gravado_16", "exento", "gravado_8"]);
    expect(calcularTotalesNC(r.conceptos).total).toBeCloseTo(saldo, 2);
  });

  it("factura con retenciones: el saldo completo las conserva", () => {
    const conRet = { ...base, tasa_ret_isr: 0.1, tasa_ret_iva: 0.04 };
    const r = conceptosPorSaldoCompleto(1020, [conRet], conRet);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conceptos[0].precio_unitario).toBe(1000);
    expect(calcularTotalesNC(r.conceptos)).toMatchObject({ retIsr: 100, retIva: 40, total: 1020 });
  });

  it("renglón sin tratamiento definido: se bloquea con motivo", () => {
    const sinTipo = { ...base, tipo_iva: null, tasa_iva: null };
    const r = conceptosPorSaldoCompleto(1000, [sinTipo], sinTipo);
    expect(r).toEqual({ ok: false, motivo: MOTIVO_TRATAMIENTO_INDEFINIDO });
  });

  it("saldo inválido se bloquea", () => {
    expect(conceptosPorSaldoCompleto(0, [base], base)).toEqual({
      ok: false,
      motivo: MOTIVO_SALDO_INVALIDO,
    });
  });

  it("sin conceptos de la factura usa el renglón base capturado", () => {
    const r = conceptosPorSaldoCompleto(1160, [], base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conceptos[0].precio_unitario).toBe(1000);
  });
});
