import { describe, it, expect } from "vitest";
import { TOLERANCIA_SOBREPAGO } from "@/lib/financial/toleranciaPago";

describe("TOLERANCIA_SOBREPAGO (BUG-15 / FE-15)", () => {
  it("es medio centavo", () => {
    expect(TOLERANCIA_SOBREPAGO).toBe(0.005);
  });

  it("bloquea un sobrepago real de 1 centavo", () => {
    const saldo = 100;
    expect(100.01 > saldo + TOLERANCIA_SOBREPAGO).toBe(true);
  });

  it("absorbe el error de redondeo de medio centavo", () => {
    const saldo = 100;
    expect(100.005 > saldo + TOLERANCIA_SOBREPAGO).toBe(false);
  });

  it("marca liquidada cuando el remanente cabe en la tolerancia", () => {
    const queda = 0.004;
    expect(queda <= TOLERANCIA_SOBREPAGO).toBe(true);
  });
});
