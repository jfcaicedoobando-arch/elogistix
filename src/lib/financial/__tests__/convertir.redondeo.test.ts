/**
 * Regresión (v13.823.336): el tablero y el detalle mostraban el mismo embarque
 * con diferencias de centavos porque cada pantalla redondeaba en otro momento.
 * El canon `aMxn` redondea a 2 decimales, así que sumar renglones convertidos
 * da lo mismo que convertir y redondear al final.
 */
import { describe, expect, it } from "vitest";
import { aMxn, sumarEnMxn } from "@/lib/financial/convertir";
import { roundMoney } from "@/lib/financial/financialUtils";

describe("aMxn · redondeo canónico a 2 decimales", () => {
  it("redondea la conversión con tipo de cambio directo", () => {
    expect(aMxn(100.005, "USD", 17.3317).monto).toBe(1733.26);
  });

  it("redondea también cuando usa el tipo de cambio de respaldo", () => {
    expect(aMxn(33.333, "USD", null, { fallback: 18.1234 }).monto).toBe(604.11);
  });

  it("MXN pasa sin conversión", () => {
    expect(aMxn(1234.56, "MXN", null).monto).toBe(1234.56);
  });

  it("la suma por renglón coincide con el total del canon", () => {
    const filas = [
      { monto: 33.33, moneda: "USD" },
      { monto: 66.67, moneda: "USD" },
      { monto: 10.01, moneda: "MXN" },
    ];
    const tc = { usd: 17.3317 };
    const porRenglon = roundMoney(
      filas.reduce((acc, f) => acc + aMxn(f.monto, f.moneda, f.moneda === "MXN" ? 1 : tc.usd).monto, 0),
    );
    const total = sumarEnMxn(filas, (f) => ({ monto: f.monto, moneda: f.moneda }), tc).total;
    expect(total).toBe(porRenglon);
  });
});
