import { describe, it, expect } from "vitest";
import {
  agruparPorMoneda,
  bucketDeFactura,
  calcularAging,
} from "../estadoCuentaAging";
import type { FacturaEstadoCuenta } from "../estadoCuenta";

function factura(over: Partial<FacturaEstadoCuenta>): FacturaEstadoCuenta {
  return {
    id: "1",
    numero: "F1",
    cliente_id: "c1",
    cliente_nombre: "Cliente",
    expediente: "EXP1",
    moneda: "USD",
    total: 100,
    pagado: 0,
    notas_credito_aplicadas: 0,
    saldo: 100,
    fecha_emision: "2026-01-01",
    fecha_vencimiento: "2026-01-31",
    dias_vencido: 0,
    estatus_cobranza: "Vigente",
    estado_factura: "Emitida",
    pagos: [],
    notas_credito: [],
    ...over,
  };
}

describe("bucketDeFactura", () => {
  it("clasifica por días vencidos", () => {
    expect(bucketDeFactura(0)).toBe("corriente");
    expect(bucketDeFactura(1)).toBe("1-30");
    expect(bucketDeFactura(30)).toBe("1-30");
    expect(bucketDeFactura(31)).toBe("31-60");
    expect(bucketDeFactura(61)).toBe("61-90");
    expect(bucketDeFactura(91)).toBe("90+");
  });
});

describe("calcularAging", () => {
  it("suma por bucket y moneda, ignorando facturas sin saldo", () => {
    const buckets = calcularAging([
      factura({ id: "a", dias_vencido: 0, saldo: 100, moneda: "USD" }),
      factura({ id: "b", dias_vencido: 45, saldo: 200, moneda: "MXN" }),
      factura({ id: "c", dias_vencido: 45, saldo: 50, moneda: "USD" }),
      factura({ id: "d", dias_vencido: 120, saldo: 0, moneda: "USD" }),
    ]);
    const porId = Object.fromEntries(buckets.map((b) => [b.id, b]));
    expect(porId.corriente.usd).toBe(100);
    expect(porId["31-60"].mxn).toBe(200);
    expect(porId["31-60"].usd).toBe(50);
    expect(porId["31-60"].conteo).toBe(2);
    expect(porId["90+"].conteo).toBe(0);
  });
});

describe("agruparPorMoneda", () => {
  const rows = [
    factura({ id: "a", moneda: "USD", fecha_emision: "2026-01-01", total: 100, saldo: 100 }),
    factura({ id: "b", moneda: "USD", fecha_emision: "2026-02-01", total: 50, pagado: 20, saldo: 30 }),
    factura({ id: "c", moneda: "MXN", fecha_emision: "2026-01-15", total: 500, saldo: 500 }),
  ];

  it("separa monedas y calcula subtotales", () => {
    const grupos = agruparPorMoneda(rows, { key: "fecha", dir: "desc" });
    expect(grupos.map((g) => g.moneda)).toEqual(["MXN", "USD"]);
    const usd = grupos.find((g) => g.moneda === "USD");
    expect(usd?.cargos).toBe(150);
    expect(usd?.abonos).toBe(20);
    expect(usd?.saldo).toBe(130);
  });

  it("acumula saldo en orden cronológico aunque la vista esté ordenada al revés", () => {
    const grupos = agruparPorMoneda(rows, { key: "fecha", dir: "desc" });
    const usd = grupos.find((g) => g.moneda === "USD");
    expect(usd?.filas[0].id).toBe("b");
    expect(usd?.filas[0].saldoAcumulado).toBe(130);
    expect(usd?.filas[1].saldoAcumulado).toBe(100);
  });

  it("ordena por saldo ascendente cuando se pide", () => {
    const grupos = agruparPorMoneda(rows, { key: "saldo", dir: "asc" });
    const usd = grupos.find((g) => g.moneda === "USD");
    expect(usd?.filas.map((f) => f.id)).toEqual(["b", "a"]);
  });
});
