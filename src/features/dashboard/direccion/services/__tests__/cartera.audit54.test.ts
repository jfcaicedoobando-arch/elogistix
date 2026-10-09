import { describe, expect, it } from "vitest";
import { calcularAntiguedad, calcularHero } from "../calculosCartera";
import { calcularSaldosCartera, saldoEnMonedaFactura } from "../saldoCartera";
import type { FacturaRow, NotaCreditoRow, PagoRow } from "../loaders";

const hoy = new Date("2026-10-09T18:00:00Z");
const fallbacks = { usd: 20, eur: 22 };
const factura = (over: Partial<FacturaRow> = {}): FacturaRow => ({
  id: "a8", total: 1.16, moneda: "MXN", tipo_cambio: null,
  fecha_emision: "2025-01-01", fecha_vencimiento: "2026-10-01", estado: "Pagada",
  cliente_id: "c54", timbrado_en: null, uuid_fiscal: null, acuse_cancelacion_status: null,
  ...over,
});
const pago = (monto = 1.15, estado_rep: string | null = null): PagoRow => ({
  factura_id: "a8", monto_aplicado_factura: monto, moneda: "MXN",
  tipo_cambio: null, fecha_pago: "2026-10-01", estado_rep,
});
const nc = (monto: number, moneda = "MXN", tipo_cambio: number | null = null): NotaCreditoRow => ({
  factura_id: "a8", monto, moneda, tipo_cambio,
});

function resumen(f: FacturaRow, pagos: PagoRow[], ncs: NotaCreditoRow[] = []) {
  const antiguedad = calcularAntiguedad([f], pagos, fallbacks, hoy, ncs);
  const hero = calcularHero({
    aggs: [], facturas: [], facturasCartera: [f], pagosCartera: pagos, ncsCartera: ncs,
    antiguedad, fallbacks, hoy, mesActual: "2026-10", mesPrev: "2026-09",
  });
  return { antiguedad, hero, saldo: calcularSaldosCartera([f], pagos, ncs, fallbacks).get(f.id) };
}

describe("Dirección AUD54 · deuda nativa documentada", () => {
  it("A8 Pagada conserva estado y saldo 0.01 en aging y clientes vencidos", () => {
    const f = factura();
    const p = pago();
    const r = resumen(f, [p]);
    expect(r.saldo).toEqual({ saldo: 0.01, tieneSaldo: true, monto_mxn: 0.01 });
    expect(r.antiguedad.find((b) => b.bucket === "1-30")).toEqual({ bucket: "1-30", monto_mxn: 0.01, facturas: 1 });
    expect(r.hero.cartera_vencida_mxn).toBe(0.01);
    expect(r.hero.cartera_vencida_clientes).toBe(1);
    expect(f.estado).toBe("Pagada");
    expect(p.monto_aplicado_factura).toBe(1.15);
  });

  it.each([0, 0.0049, 0.005, 0.01])("clasifica saldo nativo %s antes de valuar USD", (saldo) => {
    const r = resumen(factura({ total: saldo, estado: "Emitida", moneda: "USD", tipo_cambio: 200 }), []);
    const esperado = saldo >= 0.005;
    expect(r.saldo?.tieneSaldo).toBe(esperado);
    expect(r.antiguedad.reduce((n, b) => n + b.facturas, 0)).toBe(esperado ? 1 : 0);
    expect(r.hero.cartera_vencida_clientes).toBe(esperado ? 1 : 0);
    // USD 0.0049 equivale a MXN 0.98, pero no crea deuda monetaria nativa.
    if (!esperado) expect(r.hero.cartera_vencida_mxn).toBe(0);
  });

  it("no redondea una aplicación FX antes de restar en Decimal", () => {
    const f = factura({ moneda: "USD", tipo_cambio: 20 });
    const p = { ...pago(1.155), moneda: "MXN" };
    const r = resumen(f, [p]);
    expect(saldoEnMonedaFactura(f, [p], [])).toBe(0.005);
    expect(r.saldo?.tieneSaldo).toBe(true);
    expect(r.hero.cartera_vencida_clientes).toBe(1);
    expect(r.saldo?.monto_mxn).toBe(0.1);
    expect(r.hero.cartera_vencida_mxn).toBe(0.1);
  });

  it("un centavo USD convertido a 0.20 MXN sigue contando", () => {
    const r = resumen(factura({ moneda: "USD", tipo_cambio: 20 }), [pago()]);
    expect(r.saldo).toEqual({ saldo: 0.01, tieneSaldo: true, monto_mxn: 0.2 });
    expect(r.hero.cartera_vencida_mxn).toBe(0.2);
    expect(r.hero.cartera_vencida_clientes).toBe(1);
  });

  const sinEvidencia = [[], [pago(1.15, "Cancelado")], [pago(0)], [pago(-1)]].map((pagos) => ({ pagos }));
  it.each(sinEvidencia)("Pagada sin pago activo positivo conserva ámbito legado %#", ({ pagos }) => {
    const r = resumen(factura(), pagos);
    expect(r.saldo).toBeUndefined();
    expect(r.hero.cartera_vencida_clientes).toBe(0);
    expect(r.antiguedad.every((b) => b.facturas === 0)).toBe(true);
  });

  it("Pagada con pago activo completo tiene saldo cero y no cuenta como deuda", () => {
    const r = resumen(factura(), [pago(1.16)]);
    expect(r.saldo).toEqual({ saldo: 0, tieneSaldo: false, monto_mxn: 0 });
    expect(r.hero.cartera_vencida_clientes).toBe(0);
  });

  it("una NC no se convierte en evidencia de pago del legado", () => {
    expect(resumen(factura(), [], [nc(1.15)]).saldo).toBeUndefined();
  });

  it("resta NC vigente convertida, varias NC y pagos sólo una vez", () => {
    const f = factura({ total: 100, moneda: "USD", tipo_cambio: 20 });
    const r = resumen(f, [pago(98.99)], [nc(10, "MXN"), nc(1, "EUR", 22)]);
    // 0.50 USD + 1.10 USD de NC exceden el residual: saldo cero, sin deuda.
    expect(r.saldo?.saldo).toBe(0);
    expect(r.hero.cartera_vencida_clientes).toBe(0);
    const ncs = [nc(0.001), nc(0.004)];
    expect(resumen(factura(), [pago()], ncs).saldo?.saldo).toBe(0.005);
    expect(resumen(factura(), [pago()], ncs).saldo?.tieneSaldo).toBe(true);
  });

  it("NC en MXN contra USD conserva el empate 1.16 - 23.10/20", () => {
    const r = resumen(factura({ estado: "Emitida", moneda: "USD", tipo_cambio: 20 }), [], [nc(23.1, "MXN")]);
    expect(r.saldo?.saldo).toBe(0.005);
    expect(r.saldo?.tieneSaldo).toBe(true);
  });

  it("redondea cada valuación monetaria antes de agregar sin alterar saldos nativos", () => {
    const fs = [factura({ id: "f1", estado: "Emitida", total: 0.005 }), factura({ id: "f2", estado: "Emitida", total: 0.005 })];
    const saldos = calcularSaldosCartera(fs, [], [], fallbacks);
    expect(saldos.get("f1")?.saldo).toBe(0.005);
    expect(calcularAntiguedad(fs, [], fallbacks, hoy).find((b) => b.bucket === "1-30"))
      .toEqual({ bucket: "1-30", monto_mxn: 0.02, facturas: 2 });
  });

  it("sin TC fiable conserva deuda nativa y la valuación MXN existente", () => {
    const f = factura({ estado: "Emitida", total: 0.01, moneda: "USD", tipo_cambio: null });
    const resultado = calcularSaldosCartera([f], [], [], {}).get(f.id);
    expect(resultado).toEqual({ saldo: 0.01, tieneSaldo: true, monto_mxn: 0 });
  });

  it("NC extingue el centavo sin tocar el cobro", () => {
    const r = resumen(factura(), [pago()], [nc(0.01)]);
    expect(r.saldo).toEqual({ saldo: 0, tieneSaldo: false, monto_mxn: 0 });
    expect(r.hero.cartera_vencida_mxn).toBe(0);
    expect(r.hero.cartera_vencida_clientes).toBe(0);
  });

  it.each(["Cancelada", "Sustituida"])("excluye %s incluso con aplicaciones", (estado) => {
    expect(resumen(factura({ estado }), [pago()]).saldo).toBeUndefined();
  });

  it("pago y NC de otra factura no cubren ni prueban el saldo de A8", () => {
    const ajeno = { ...pago(), factura_id: "ajena" };
    expect(resumen(factura(), [ajeno], [{ ...nc(0.01), factura_id: "ajena" }]).saldo).toBeUndefined();
    expect(resumen(factura({ estado: "Emitida" }), [ajeno]).saldo?.saldo).toBe(1.16);
  });
});
