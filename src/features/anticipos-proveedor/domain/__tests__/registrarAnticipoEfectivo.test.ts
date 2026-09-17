/**
 * MNY P1.1 · en Efectivo no sale dinero de ninguna cuenta: el selector nunca
 * preselecciona y limpia la cuenta heredada del método anterior (Transferencia),
 * para que la RPC no reciba una cuenta vieja y genere un cargo bancario falso.
 */
import { describe, it, expect } from "vitest";
import { resolverCuentaBancaria } from "../registrarAnticipoPolicy";

const cuentas = [
  { id: "cta-mxn-1", moneda: "MXN" },
  { id: "cta-mxn-2", moneda: "MXN" },
];

describe("resolverCuentaBancaria · requiereCuenta", () => {
  it("Transferencia preselecciona la primera cuenta compatible", () => {
    expect(resolverCuentaBancaria(undefined, cuentas, true)).toBe("cta-mxn-1");
  });

  it("Transferencia → Efectivo limpia la cuenta ya seleccionada", () => {
    expect(resolverCuentaBancaria("cta-mxn-1", cuentas, false)).toBe("");
  });

  it("Efectivo no preselecciona ninguna cuenta", () => {
    expect(resolverCuentaBancaria(undefined, cuentas, false)).toBeNull();
    expect(resolverCuentaBancaria("", cuentas, false)).toBeNull();
  });

  it("Transferencia limpia una cuenta de otra moneda y respeta la compatible", () => {
    expect(resolverCuentaBancaria("cta-usd", cuentas, true)).toBe("");
    expect(resolverCuentaBancaria("cta-mxn-2", cuentas, true)).toBeNull();
  });
});
