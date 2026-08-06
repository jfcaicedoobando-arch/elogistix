import { describe, it, expect } from "vitest";
import { registrarAnticipoSchema } from "../components/registrarAnticipo.schema";

const base = {
  proveedorId: "11111111-1111-4111-8111-111111111111",
  monto: 100,
  moneda: "MXN" as const,
  fechaAnticipo: "2026-08-06",
  metodoPago: "Transferencia" as const,
  cuentaBancariaId: "22222222-2222-4222-8222-222222222222",
};

describe("registrarAnticipoSchema", () => {
  it("acepta un anticipo en pesos con cuenta bancaria", () => {
    expect(registrarAnticipoSchema.safeParse(base).success).toBe(true);
  });

  it("exige cuenta bancaria salvo cuando el método es Efectivo", () => {
    const sinCuenta = { ...base, cuentaBancariaId: "" };
    expect(registrarAnticipoSchema.safeParse(sinCuenta).success).toBe(false);
    expect(
      registrarAnticipoSchema.safeParse({ ...sinCuenta, metodoPago: "Efectivo" }).success,
    ).toBe(true);
  });

  it("exige tipo de cambio cuando la moneda no es MXN", () => {
    const usd = { ...base, moneda: "USD" as const };
    expect(registrarAnticipoSchema.safeParse(usd).success).toBe(false);
    expect(registrarAnticipoSchema.safeParse({ ...usd, tipoCambioUsd: 18.5 }).success).toBe(true);
  });

  it("rechaza montos no positivos", () => {
    expect(registrarAnticipoSchema.safeParse({ ...base, monto: 0 }).success).toBe(false);
  });
});
