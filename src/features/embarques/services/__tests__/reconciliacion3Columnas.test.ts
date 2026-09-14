import { describe, it, expect } from "vitest";
import { buildFilas3C } from "@/features/embarques/services/reconciliacion3Columnas";
import { generarCsvReconciliacion3C } from "../reconciliacion3Columnas.helpers";

describe("buildFilas3C", () => {
  const cotizados = [
    { id: "1", cotizacion_id: "c1", version: 1, concepto: "Flete", proveedor: "X",
      moneda: "USD", cantidad: 1, costo_unitario: 1000, costo_total: 1000,
      precio_venta: 1200, precio_total: 1200 },
    { id: "2", cotizacion_id: "c1", version: 1, concepto: "THC", proveedor: "X",
      moneda: "USD", cantidad: 1, costo_unitario: 200, costo_total: 200,
      precio_venta: 240, precio_total: 240 },
  ];

  it("aplica el delta sólo a los conceptos que cambiaron", () => {
    const delta = [{ concepto: "Flete", monto_anterior: 1000, monto_actual: 1100 }];
    const filas = buildFilas3C(cotizados, delta, []);
    const flete = filas.find((f) => f.concepto === "Flete")!;
    const thc = filas.find((f) => f.concepto === "THC")!;
    expect(flete.refrescado).toBe(1100);
    expect(thc.refrescado).toBe(200);
  });

  it("ignora conceptos eliminados en la tarifa vigente (monto_actual=null)", () => {
    const delta = [{ concepto: "Flete", monto_actual: null }];
    const filas = buildFilas3C(cotizados, delta, []);
    expect(filas.find((f) => f.concepto === "Flete")!.refrescado).toBe(1000);
  });

  it("agrega conceptos reales sin contraparte cotizada", () => {
    const reales = [{ concepto: "Maniobra extra", moneda: "USD", monto: 50 }];
    const filas = buildFilas3C([], [], reales);
    expect(filas).toHaveLength(1);
    expect(filas[0].cotizado).toBe(0);
    expect(filas[0].real).toBe(50);
  });

  it("alinea cotizado y real por (concepto, moneda) ignorando capitalización", () => {
    const reales = [{ concepto: "flete", moneda: "USD", monto: 1300 }];
    const filas = buildFilas3C(cotizados, [], reales);
    const flete = filas.find((f) => f.concepto === "Flete")!;
    expect(flete.real).toBe(1300);
    // sin duplicar la fila para "flete"
    expect(filas.filter((f) => f.concepto.toLowerCase() === "flete")).toHaveLength(1);
  });
});

describe("generarCsvReconciliacion3C", () => {
  it("escapa comas, comillas y saltos de línea sin desplazar columnas", () => {
    const fila = {
      concepto: 'Flete, manejo "especial"\nurgente', moneda: "USD",
      cotizado: 100, refrescado: 110, real: 120,
      delta_cot_vs_refr: { abs: 10, pct: 10 },
      delta_cot_vs_real: { abs: 20, pct: 20 },
      delta_refr_vs_real: { abs: 10, pct: 9.09 },
      clasificacion: "alerta" as const,
      sin_factura: false,
    };
    const csv = generarCsvReconciliacion3C([fila]);
    expect(csv).toContain('"Flete, manejo ""especial""\nurgente",USD,100,110,120,20.00,alerta');
  });
});

describe("buildFilas3C — regresiones B2/B3", () => {
  const flete = (moneda: string, total: number, id: string) => ({
    id, cotizacion_id: "c1", version: 1, concepto: "Flete", proveedor: "X",
    moneda, cantidad: 1, costo_unitario: total, costo_total: total,
    precio_venta: total, precio_total: total,
  });

  it("B2: el delta con moneda sólo toca la fila de esa moneda", () => {
    const filas = buildFilas3C(
      [flete("USD", 1000, "1"), flete("MXN", 20000, "2")],
      [{ concepto: "Flete", moneda: "USD", monto_anterior: 1000, monto_actual: 1100 }],
      [],
    );
    expect(filas.find((f) => f.moneda === "USD")!.refrescado).toBe(1100);
    expect(filas.find((f) => f.moneda === "MXN")!.refrescado).toBe(20000);
  });

  it("B2: un delta legacy sin moneda no se duplica cuando el concepto está en USD y MXN", () => {
    const filas = buildFilas3C(
      [flete("USD", 1000, "1"), flete("MXN", 20000, "2")],
      [{ concepto: "Flete", monto_actual: 1100 }],
      [],
    );
    expect(filas.find((f) => f.moneda === "USD")!.refrescado).toBe(1000);
    expect(filas.find((f) => f.moneda === "MXN")!.refrescado).toBe(20000);
  });

  it("B2: un delta legacy sin moneda sí aplica cuando el concepto es único", () => {
    const filas = buildFilas3C([flete("USD", 1000, "1")], [{ concepto: "Flete", monto_actual: 1100 }], []);
    expect(filas[0].refrescado).toBe(1100);
  });

  it("B3: dos cotizados Maniobras MXN se agrupan y el real no se duplica", () => {
    const cot = (total: number, id: string) => ({
      id, cotizacion_id: "c1", version: 1, concepto: "Maniobras", proveedor: "X",
      moneda: "MXN", cantidad: 1, costo_unitario: total, costo_total: total,
      precio_venta: total, precio_total: total,
    });
    const filas = buildFilas3C(
      [cot(1000, "1"), cot(500, "2")],
      [],
      [{ concepto: "Maniobras", moneda: "MXN", monto: 1000, tiene_factura: true }],
    );
    expect(filas).toHaveLength(1);
    expect(filas[0].cotizado).toBe(1500);
    expect(filas[0].real).toBe(1000);
    expect(filas.reduce((s, f) => s + f.real, 0)).not.toBe(2000);
  });
});
