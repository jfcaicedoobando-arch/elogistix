/**
 * v13.56.1 — Tests del checklist fiscal previo al timbrado de una factura CFDI.
 * Replica la lógica dentro de `DialogTimbrarFactura` para validarla aislada.
 * Si la regla cambia, actualizar en ambos lados.
 */
import { describe, it, expect } from "vitest";

interface FiscalInput {
  rfc: string;
  cp: string;
  regimen: string;
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
}

function buildChecks(i: FiscalInput) {
  return [
    { ok: !!i.rfc && i.rfc.length >= 12, label: "rfc" },
    { ok: !!i.cp && /^\d{5}$/.test(i.cp), label: "cp" },
    { ok: !!i.regimen, label: "regimen" },
    { ok: !!i.usoCfdi, label: "usoCfdi" },
    { ok: !!i.formaPago, label: "formaPago" },
    { ok: !!i.metodoPago, label: "metodoPago" },
  ];
}

function puedeTimbrar(i: FiscalInput): boolean {
  return buildChecks(i).every((c) => c.ok);
}

const valido: FiscalInput = {
  rfc: "XAXX010101000",
  cp: "06600",
  regimen: "601",
  usoCfdi: "G03",
  formaPago: "03",
  metodoPago: "PUE",
};

describe("DialogTimbrarFactura — checklist fiscal", () => {
  it("acepta un payload fiscal completo", () => {
    expect(puedeTimbrar(valido)).toBe(true);
  });

  it("rechaza RFC vacío", () => {
    expect(puedeTimbrar({ ...valido, rfc: "" })).toBe(false);
  });

  it("rechaza RFC corto (< 12 chars)", () => {
    expect(puedeTimbrar({ ...valido, rfc: "ABCDE" })).toBe(false);
  });

  it("rechaza CP que no sea de 5 dígitos", () => {
    expect(puedeTimbrar({ ...valido, cp: "1234" })).toBe(false);
    expect(puedeTimbrar({ ...valido, cp: "ABCDE" })).toBe(false);
    expect(puedeTimbrar({ ...valido, cp: "123456" })).toBe(false);
  });

  it("rechaza régimen fiscal vacío", () => {
    expect(puedeTimbrar({ ...valido, regimen: "" })).toBe(false);
  });

  it("rechaza uso CFDI vacío", () => {
    expect(puedeTimbrar({ ...valido, usoCfdi: "" })).toBe(false);
  });

  it("rechaza forma de pago SAT vacía", () => {
    expect(puedeTimbrar({ ...valido, formaPago: "" })).toBe(false);
  });

  it("rechaza método de pago SAT vacío", () => {
    expect(puedeTimbrar({ ...valido, metodoPago: "" })).toBe(false);
  });

  it("expone un check por cada regla", () => {
    expect(buildChecks(valido)).toHaveLength(6);
  });
});
