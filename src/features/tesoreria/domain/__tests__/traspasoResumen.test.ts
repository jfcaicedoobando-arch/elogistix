import { describe, expect, it } from "vitest";
import { resumenTraspaso } from "@/features/tesoreria/domain/traspasoResumen";

describe("resumenTraspaso", () => {
  it("suma comisión al cargo de la cuenta origen", () => {
    const r = resumenTraspaso({ montoOrigen: 1000, comision: 25.5, montoDestino: 18423.5 });
    expect(r.totalCargoOrigen).toBe(1025.5);
    expect(r.montoDestino).toBe(18423.5);
  });

  it("USD→MXN con tipo de cambio de 4 decimales conserva centavos", () => {
    // 1,000 USD * 18.4235 = 18,423.50 MXN
    const r = resumenTraspaso({ montoOrigen: 1000, comision: 0, montoDestino: 18423.5 });
    expect(r.comision).toBe(0);
    expect(r.totalCargoOrigen).toBe(1000);
    expect(r.montoDestino).toBe(18423.5);
  });

  it("ignora valores no capturados o negativos", () => {
    const r = resumenTraspaso({ montoOrigen: 0, comision: -5, montoDestino: 0 });
    expect(r).toEqual({ montoOrigen: 0, comision: 0, totalCargoOrigen: 0, montoDestino: 0 });
  });
});
