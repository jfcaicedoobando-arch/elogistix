/**
 * MNY P1.3 · validación del monto al aplicar un anticipo: el monto se captura en
 * la moneda del anticipo y el tope viene convertido con el DOF de la fecha.
 */
import { describe, it, expect } from "vitest";
import { validarMontoAplicacion } from "../validarMontoAplicacion";
import { buildSchema } from "../aplicarAnticipoSchema";

const base = {
  disponible: 100,
  monedaAnticipo: "USD",
  monedaFactura: "EUR",
  fecha: "2026-09-16",
};

describe("validarMontoAplicacion", () => {
  it("acepta un monto dentro del tope convertido", () => {
    expect(validarMontoAplicacion({ ...base, montoNum: 86.68, tope: 86.68 }).ok).toBe(true);
  });

  it("rechaza monto mayor al tope convertido y lo informa en la moneda del anticipo", () => {
    const r = validarMontoAplicacion({ ...base, montoNum: 95.29, tope: 86.68 });
    expect(r.ok).toBe(false);
    expect(r.error?.method).toBe("ANTICIPO_APLICAR_FACTURA_SALDO");
    expect(r.error?.description).toContain("2026-09-16");
  });

  it("falla cerrado cuando no hay tipo de cambio", () => {
    const r = validarMontoAplicacion({ ...base, montoNum: 10, tope: null });
    expect(r.ok).toBe(false);
    expect(r.error?.method).toBe("ANTICIPO_APLICAR_FACTURA_SIN_TC");
    expect(r.error?.description).toContain("EUR");
    expect(r.error?.description).toContain("USD");
  });

  it("rechaza monto mayor al saldo a favor del anticipo", () => {
    const r = validarMontoAplicacion({ ...base, montoNum: 200, tope: 500 });
    expect(r.error?.method).toBe("ANTICIPO_APLICAR_FACTURA_TOPE");
  });
});

describe("aplicarAnticipoSchema · tope entre monedas", () => {
  const datos = {
    facturaId: "11111111-1111-4111-8111-111111111111",
    saldoFactura: 100,
    monedaFactura: "EUR",
    fechaAplicacion: "2026-09-16",
  };

  it("no acepta 100 USD contra 100 EUR sin convertir (tope 86.68)", () => {
    const res = buildSchema(1000, "USD", 86.68).safeParse({ ...datos, monto: 100 });
    expect(res.success).toBe(false);
  });

  it("acepta el monto dentro del tope convertido", () => {
    const res = buildSchema(1000, "USD", 86.68).safeParse({ ...datos, monto: 86.68 });
    expect(res.success).toBe(true);
  });

  it("sin tipo de cambio (tope null) pide capturarlo", () => {
    const res = buildSchema(1000, "USD", null).safeParse({ ...datos, monto: 10 });
    expect(res.success).toBe(false);
    const msg = res.success ? "" : res.error.issues.map((i) => i.message).join(" ");
    expect(msg).toContain("tipo de cambio");
  });
});
