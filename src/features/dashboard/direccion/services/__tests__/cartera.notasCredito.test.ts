/**
 * Ola de exactitud financiera (v13.823.5): el aging/cartera de Dirección debe
 * usar el canon de Cobranza — saldo = total − pagos − NC APLICADAS.
 */
import { describe, it, expect } from "vitest";
import { calcularAntiguedad, calcularHero } from "../calculos";
import type { FacturaRow, NotaCreditoRow, PagoRow } from "../loaders";

const HOY = new Date(Date.UTC(2026, 1, 1)); // 2026-02-01

function factura(over: Partial<FacturaRow> = {}): FacturaRow {
  return {
    id: "f1", total: 1000, moneda: "MXN", tipo_cambio: null,
    fecha_emision: "2026-01-01", fecha_vencimiento: "2026-01-15", estado: "Emitida",
    cliente_id: "c1", timbrado_en: "2026-01-01", uuid_fiscal: "uuid-1",
    acuse_cancelacion_status: null,
    ...over,
  };
}

function pago(monto: number): PagoRow {
  return { factura_id: "f1", monto_aplicado_factura: monto, moneda: "MXN", tipo_cambio: null, fecha_pago: "2026-01-05" };
}

function nc(monto: number, over: Partial<NotaCreditoRow> = {}): NotaCreditoRow {
  return { factura_id: "f1", monto, moneda: "MXN", tipo_cambio: null, ...over };
}

function totalVencido(buckets: ReturnType<typeof calcularAntiguedad>): number {
  return buckets.filter((b) => b.bucket !== "Corriente").reduce((s, b) => s + b.monto_mxn, 0);
}

describe("aging de Dirección con notas de crédito", () => {
  it("resta pagos y NC aplicadas: 1000 − 200 − 300 = 500", () => {
    const out = calcularAntiguedad([factura()], [pago(200)], 18, HOY, [nc(300)]);
    expect(totalVencido(out)).toBeCloseTo(500, 2);
    expect(out.find((b) => b.bucket === "1-30")!.facturas).toBe(1);
  });

  it("sin NC el saldo es total − pagos (no hay doble descuento)", () => {
    const out = calcularAntiguedad([factura()], [pago(200)], 18, HOY, []);
    expect(totalVencido(out)).toBeCloseTo(800, 2);
  });

  it("una factura totalmente cubierta por pagos + NC sale del aging", () => {
    const out = calcularAntiguedad([factura()], [pago(400)], 18, HOY, [nc(600)]);
    expect(out.reduce((s, b) => s + b.facturas, 0)).toBe(0);
    expect(totalVencido(out)).toBe(0);
  });

  it("una NC que cubre el total completo deja la factura fuera", () => {
    const out = calcularAntiguedad([factura()], [], 18, HOY, [nc(1000)]);
    expect(out.reduce((s, b) => s + b.facturas, 0)).toBe(0);
  });

  it("NC de otra factura no afecta el saldo", () => {
    const out = calcularAntiguedad([factura()], [], 18, HOY, [nc(500, { factura_id: "otra" })]);
    expect(totalVencido(out)).toBeCloseTo(1000, 2);
  });

  it("convierte NC en USD al equivalente MXN de la factura", () => {
    const out = calcularAntiguedad([factura()], [], 18, HOY, [nc(10, { moneda: "USD", tipo_cambio: 20 })]);
    expect(totalVencido(out)).toBeCloseTo(800, 2);
  });

  it("mantiene facturas antiguas sin ventana de seis meses", () => {
    const out = calcularAntiguedad(
      [factura({ fecha_emision: "2024-01-01", fecha_vencimiento: "2024-02-01" })], [], 18, HOY, [nc(300)],
    );
    expect(out.find((b) => b.bucket === "+60")!.monto_mxn).toBeCloseTo(700, 2);
  });
});

describe("calcularHero: clientes con cartera vencida", () => {
  const heroBase = {
    aggs: [], facturas: [], fallbackUsd: 18, hoy: HOY,
    mesActual: "2026-02", mesPrev: "2026-01",
  };

  it("no cuenta al cliente cuando pagos + NC cubren la factura", () => {
    const facturasCartera = [factura()];
    const pagosCartera = [pago(400)];
    const ncsCartera = [nc(600)];
    const antiguedad = calcularAntiguedad(facturasCartera, pagosCartera, 18, HOY, ncsCartera);
    const hero = calcularHero({ ...heroBase, facturasCartera, pagosCartera, ncsCartera, antiguedad });
    expect(hero.cartera_vencida_clientes).toBe(0);
    expect(hero.cartera_vencida_mxn).toBe(0);
  });

  it("cuenta al cliente cuando queda saldo tras la NC", () => {
    const facturasCartera = [factura()];
    const ncsCartera = [nc(300)];
    const antiguedad = calcularAntiguedad(facturasCartera, [], 18, HOY, ncsCartera);
    const hero = calcularHero({ ...heroBase, facturasCartera, pagosCartera: [], ncsCartera, antiguedad });
    expect(hero.cartera_vencida_clientes).toBe(1);
    expect(hero.cartera_vencida_mxn).toBeCloseTo(700, 2);
  });
});
