/**
 * Revisión v13.823.6: `saldoCartera` debe ser espejo EXACTO del canon SQL
 * (`cobranza_listado` + `nc_aplicadas_en_moneda_factura`):
 *  - `monto_aplicado_factura` ya está en moneda de FACTURA (no se reconvierte);
 *  - las NC se convierten a moneda de factura con las reglas de la función SQL;
 *  - el saldo NETO se convierte a MXN con el TC de la factura.
 */
import { describe, it, expect } from "vitest";
import { calcularSaldosCarteraMxn, ncEnMonedaFactura, saldoEnMonedaFactura } from "../saldoCartera";
import type { FacturaRow, NotaCreditoRow, PagoRow } from "../loaders";

function factura(over: Partial<FacturaRow> = {}): FacturaRow {
  return {
    id: "f1", total: 1000, moneda: "MXN", tipo_cambio: null,
    fecha_emision: "2026-01-01", fecha_vencimiento: "2026-01-15", estado: "Emitida",
    cliente_id: "c1", timbrado_en: null, uuid_fiscal: null, acuse_cancelacion_status: null,
    ...over,
  };
}
function pago(over: Partial<PagoRow>): PagoRow {
  return { factura_id: "f1", monto_aplicado_factura: 0, moneda: "MXN", tipo_cambio: null, fecha_pago: "2026-01-05", ...over };
}
function nc(over: Partial<NotaCreditoRow>): NotaCreditoRow {
  return { factura_id: "f1", monto: 0, moneda: "MXN", tipo_cambio: null, ...over };
}
const saldoMxn = (f: FacturaRow, pagos: PagoRow[], ncs: NotaCreditoRow[], fallbackUsd = 18): number =>
  calcularSaldosCarteraMxn([f], pagos, ncs, fallbackUsd).get(f.id) ?? 0;

describe("pagos: monto_aplicado_factura ya viene en moneda de factura", () => {
  it("factura USD 100 @20; pago MXN con monto_aplicado_factura 50 => saldo MXN 1000", () => {
    const f = factura({ total: 100, moneda: "USD", tipo_cambio: 20 });
    const p = pago({ monto_aplicado_factura: 50, moneda: "MXN", tipo_cambio: null });
    // 100 USD − 50 USD = 50 USD ⇒ 50 × 20 = 1000 MXN (NO se convierte con la moneda del pago).
    expect(saldoMxn(f, [p], [])).toBeCloseTo(1000, 2);
  });

  it("factura MXN 1000; pago USD con monto_aplicado_factura 500 => saldo 500", () => {
    const f = factura({ total: 1000, moneda: "MXN" });
    const p = pago({ monto_aplicado_factura: 500, moneda: "USD", tipo_cambio: 20 });
    expect(saldoMxn(f, [p], [])).toBeCloseTo(500, 2);
  });

  it("suma varios pagos parciales de la misma factura", () => {
    const f = factura({ total: 1000 });
    expect(saldoMxn(f, [pago({ monto_aplicado_factura: 300 }), pago({ monto_aplicado_factura: 200 })], []))
      .toBeCloseTo(500, 2);
  });
});

describe("NC en moneda de factura (espejo de nc_aplicadas_en_moneda_factura)", () => {
  it("misma moneda: usa el monto nominal y el TC de la FACTURA, no el de la NC", () => {
    const f = factura({ total: 100, moneda: "USD", tipo_cambio: 20 });
    const n = nc({ monto: 10, moneda: "USD", tipo_cambio: 17 });
    // (100 − 10) USD × 20 = 1800 MXN.
    expect(saldoMxn(f, [], [n])).toBeCloseTo(1800, 2);
  });

  it("factura MXN + NC USD con TC de NC válido: monto × tc_nc", () => {
    const f = factura({ total: 1000, moneda: "MXN" });
    expect(saldoMxn(f, [], [nc({ monto: 10, moneda: "USD", tipo_cambio: 20 })])).toBeCloseTo(800, 2);
  });

  it("factura USD + NC MXN con TC de factura válido: monto / tc_factura", () => {
    const f = factura({ total: 100, moneda: "USD", tipo_cambio: 20 });
    // NC 200 MXN = 10 USD ⇒ saldo 90 USD ⇒ 1800 MXN.
    expect(saldoMxn(f, [], [nc({ monto: 200, moneda: "MXN" })])).toBeCloseTo(1800, 2);
  });

  it("factura USD + NC EUR con ambos TC: (monto × tc_nc) / tc_factura", () => {
    const f = factura({ total: 100, moneda: "USD", tipo_cambio: 20 });
    const n = nc({ monto: 10, moneda: "EUR", tipo_cambio: 22 });
    // 10 EUR = 220 MXN = 11 USD ⇒ saldo 89 USD ⇒ 1780 MXN.
    expect(saldoMxn(f, [], [n])).toBeCloseTo(1780, 2);
  });

  it("conversión cruzada sin TC requerido: la NC no resta (igual al canon)", () => {
    const sinTcNc = factura({ total: 1000, moneda: "MXN" });
    expect(saldoMxn(sinTcNc, [], [nc({ monto: 10, moneda: "USD", tipo_cambio: null })])).toBeCloseTo(1000, 2);

    const sinTcFactura = factura({ total: 100, moneda: "USD", tipo_cambio: null });
    // Sin TC de factura la NC MXN aporta 0; el saldo se valúa con el fallback USD.
    expect(saldoEnMonedaFactura(sinTcFactura, [], [nc({ monto: 200, moneda: "MXN" })])).toBeCloseTo(100, 2);

    const cruzadaIncompleta = factura({ total: 100, moneda: "USD", tipo_cambio: 20 });
    expect(saldoMxn(cruzadaIncompleta, [], [nc({ monto: 10, moneda: "EUR", tipo_cambio: null })]))
      .toBeCloseTo(2000, 2);
  });

  it("ncEnMonedaFactura devuelve 0 cuando el canon devuelve 0", () => {
    expect(ncEnMonedaFactura({ monto: 10, moneda: "EUR", tipo_cambio: 1 }, "USD", 20)).toBe(0);
    expect(ncEnMonedaFactura({ monto: 10, moneda: "USD", tipo_cambio: null }, "MXN", null)).toBe(0);
  });

  it("no hay doble descuento: pagos y NC se restan una sola vez", () => {
    const f = factura({ total: 1000 });
    expect(saldoMxn(f, [pago({ monto_aplicado_factura: 200 })], [nc({ monto: 300 })])).toBeCloseTo(500, 2);
  });

  it("pagos + NC que cubren el total dejan saldo 0 (fuera de aging/hero)", () => {
    const f = factura({ total: 1000 });
    expect(saldoMxn(f, [pago({ monto_aplicado_factura: 400 })], [nc({ monto: 600 })])).toBeCloseTo(0, 2);
  });

  it("factura cancelada no entra en el mapa de saldos", () => {
    const f = factura({ estado: "Cancelada" });
    expect(calcularSaldosCarteraMxn([f], [], [], 18).has(f.id)).toBe(false);
  });
});
