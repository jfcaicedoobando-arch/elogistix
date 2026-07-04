import { describe, it, expect } from "vitest";
import { buildChecksTimbrado } from "../validarDatosTimbrado";

const happy = {
  rfc: "XAXX010101000",
  cp: "06600",
  regimen: "601",
  usoCfdi: "G03",
  formaPago: "03",
  metodoPago: "PUE",
};

describe("buildChecksTimbrado", () => {
  it("happy path (MXN) → puedeTimbrar=true y todos los checks ok", () => {
    const r = buildChecksTimbrado(happy);
    expect(r.puedeTimbrar).toBe(true);
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.checks).toHaveLength(7);
  });

  it("moneda extranjera con tipo de cambio válido → puedeTimbrar=true", () => {
    const r = buildChecksTimbrado({ ...happy, moneda: "USD", tipoCambio: 17.5 });
    expect(r.puedeTimbrar).toBe(true);
    expect(r.checks[6].ok).toBe(true);
  });

  it("moneda extranjera SIN tipo de cambio → falla en el check de TC", () => {
    const r = buildChecksTimbrado({ ...happy, moneda: "USD", tipoCambio: null });
    expect(r.puedeTimbrar).toBe(false);
    expect(r.checks[6].ok).toBe(false);
  });

  it("RFC corto (<12) → falla", () => {
    const r = buildChecksTimbrado({ ...happy, rfc: "ABC123" });
    expect(r.puedeTimbrar).toBe(false);
    expect(r.checks[0].ok).toBe(false);
  });

  it("CP no numérico de 5 dígitos → falla", () => {
    const r = buildChecksTimbrado({ ...happy, cp: "ABCDE" });
    expect(r.puedeTimbrar).toBe(false);
    expect(r.checks[1].ok).toBe(false);
  });

  it("CP de 4 dígitos → falla", () => {
    const r = buildChecksTimbrado({ ...happy, cp: "1234" });
    expect(r.checks[1].ok).toBe(false);
  });

  it("todos los campos vacíos (USD, TC nulo) → todos los checks fallan", () => {
    const r = buildChecksTimbrado({ rfc: "", cp: "", regimen: "", usoCfdi: "", formaPago: "", metodoPago: "", moneda: "USD", tipoCambio: null });
    expect(r.puedeTimbrar).toBe(false);
    expect(r.checks.every((c) => !c.ok)).toBe(true);
    expect(r.checks[0].label).toContain("FALTA");
  });

  it("régimen fiscal vacío → falla", () => {
    const r = buildChecksTimbrado({ ...happy, regimen: "" });
    expect(r.checks[2].ok).toBe(false);
  });
});
