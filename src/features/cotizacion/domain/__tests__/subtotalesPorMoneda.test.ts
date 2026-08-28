import { describe, it, expect } from "vitest";
import {
  subtotalesPorMoneda,
  normalizarSubtotalesMxn,
} from "../subtotalesPorMoneda";

const concepto = (moneda: string, cantidad: number, precio: number) => ({
  descripcion: "Flete",
  unidad_medida: "Servicio",
  cantidad,
  precio_unitario: precio,
  moneda,
  aplica_iva: false,
  total: cantidad * precio,
});

describe("subtotalesPorMoneda", () => {
  it("devuelve un renglón por moneda en cotizaciones mixtas", () => {
    const r = subtotalesPorMoneda(
      [concepto("USD", 2, 1000), concepto("MXN", 1, 5000), concepto("USD", 1, 550)],
      5000,
      "MXN",
    );
    expect(r).toEqual([
      { moneda: "USD", monto: 2550 },
      { moneda: "MXN", monto: 5000 },
    ]);
  });

  it("usa las columnas planas cuando no hay conceptos", () => {
    expect(subtotalesPorMoneda(null, 1500, "USD")).toEqual([{ moneda: "USD", monto: 1500 }]);
  });

  it("devuelve vacío sin conceptos ni subtotal", () => {
    expect(subtotalesPorMoneda(null, null, null)).toEqual([]);
  });

  it("normaliza la suma multimoneda a MXN", () => {
    const subtotales = [
      { moneda: "USD", monto: 100 },
      { moneda: "MXN", monto: 500 },
    ];
    expect(normalizarSubtotalesMxn(subtotales, 18)).toBe(2300);
  });

  it("devuelve null si falta TC para alguna moneda", () => {
    expect(normalizarSubtotalesMxn([{ moneda: "USD", monto: 100 }], null)).toBeNull();
    expect(normalizarSubtotalesMxn([], 18)).toBeNull();
  });
});
