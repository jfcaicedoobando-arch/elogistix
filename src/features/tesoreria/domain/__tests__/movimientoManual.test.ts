import { describe, it, expect } from "vitest";
import { validarMovimientoManual, esMovimientoManualValido } from "../movimientoManual";

describe("validarMovimientoManual", () => {
  it("requiere cuenta bancaria", () => {
    const errores = validarMovimientoManual({ fecha: "2024-01-01", concepto: "Comisión", tipo: "cargo", monto: 10 });
    expect(errores.cuentaBancariaId).toBeDefined();
  });

  it("requiere importe mayor a cero", () => {
    const errores = validarMovimientoManual({
      cuentaBancariaId: "c1", fecha: "2024-01-01", concepto: "Comisión", tipo: "cargo", monto: 0,
    });
    expect(errores.monto).toBeDefined();
  });

  it("rechaza importe negativo", () => {
    const errores = validarMovimientoManual({
      cuentaBancariaId: "c1", fecha: "2024-01-01", concepto: "Comisión", tipo: "cargo", monto: -5,
    });
    expect(errores.monto).toBeDefined();
  });

  it("requiere concepto no vacío", () => {
    const errores = validarMovimientoManual({
      cuentaBancariaId: "c1", fecha: "2024-01-01", concepto: "   ", tipo: "cargo", monto: 10,
    });
    expect(errores.concepto).toBeDefined();
  });

  it("es válido con todos los campos correctos", () => {
    const input = {
      cuentaBancariaId: "c1", fecha: "2024-01-01", concepto: "Comisión bancaria", tipo: "cargo" as const, monto: 10,
    };
    expect(esMovimientoManualValido(input)).toBe(true);
    expect(validarMovimientoManual(input)).toEqual({});
  });
});
