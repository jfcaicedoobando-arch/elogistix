/**
 * v13.171.0 — Tests del checklist fiscal previo al timbrado. Ahora incluye
 * validación de `tipo_cambio` para facturas en moneda extranjera.
 * Replica la lógica dentro de `validarDatosTimbrado.ts`; si la regla cambia,
 * actualizar en ambos lados.
 */
import { describe, it, expect } from "vitest";
import { buildChecksTimbrado } from "../../utils/validarDatosTimbrado";

const valido = {
  rfc: "XAXX010101000",
  cp: "06600",
  regimen: "601",
  usoCfdi: "G03",
  formaPago: "03",
  metodoPago: "PUE",
  moneda: "MXN",
  tipoCambio: null,
};

describe("DialogTimbrarFactura — checklist fiscal", () => {
  it("acepta un payload fiscal completo (MXN)", () => {
    expect(buildChecksTimbrado(valido).puedeTimbrar).toBe(true);
  });

  it("acepta USD con tipo de cambio válido", () => {
    expect(
      buildChecksTimbrado({ ...valido, moneda: "USD", tipoCambio: 17.5 }).puedeTimbrar,
    ).toBe(true);
  });

  it("rechaza USD sin tipo de cambio", () => {
    expect(
      buildChecksTimbrado({ ...valido, moneda: "USD", tipoCambio: null }).puedeTimbrar,
    ).toBe(false);
  });

  it("rechaza USD con tipo de cambio 0", () => {
    expect(
      buildChecksTimbrado({ ...valido, moneda: "USD", tipoCambio: 0 }).puedeTimbrar,
    ).toBe(false);
  });

  it("rechaza RFC vacío", () => {
    expect(buildChecksTimbrado({ ...valido, rfc: "" }).puedeTimbrar).toBe(false);
  });

  it("rechaza RFC corto (< 12 chars)", () => {
    expect(buildChecksTimbrado({ ...valido, rfc: "ABCDE" }).puedeTimbrar).toBe(false);
  });

  it("rechaza CP que no sea de 5 dígitos", () => {
    expect(buildChecksTimbrado({ ...valido, cp: "1234" }).puedeTimbrar).toBe(false);
    expect(buildChecksTimbrado({ ...valido, cp: "ABCDE" }).puedeTimbrar).toBe(false);
    expect(buildChecksTimbrado({ ...valido, cp: "123456" }).puedeTimbrar).toBe(false);
  });

  it("rechaza régimen fiscal vacío", () => {
    expect(buildChecksTimbrado({ ...valido, regimen: "" }).puedeTimbrar).toBe(false);
  });

  it("rechaza uso CFDI vacío", () => {
    expect(buildChecksTimbrado({ ...valido, usoCfdi: "" }).puedeTimbrar).toBe(false);
  });

  it("rechaza forma de pago SAT vacía", () => {
    expect(buildChecksTimbrado({ ...valido, formaPago: "" }).puedeTimbrar).toBe(false);
  });

  it("rechaza método de pago SAT vacío", () => {
    expect(buildChecksTimbrado({ ...valido, metodoPago: "" }).puedeTimbrar).toBe(false);
  });

  it("expone un check por cada regla (7 con tipo_cambio)", () => {
    expect(buildChecksTimbrado(valido).checks).toHaveLength(7);
  });
});
