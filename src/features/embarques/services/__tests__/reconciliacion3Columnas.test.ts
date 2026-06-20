import { describe, it, expect } from "vitest";
import { buildFilas3C } from "@/features/embarques/services/reconciliacion3Columnas";

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
