import { describe, it, expect } from "vitest";
import { buildChecksRep } from "../validarDatosTimbradoRep";

describe("buildChecksRep", () => {
  const baseOk = {
    facturaUuid: "11111111-2222-3333-4444-555555555555",
    facturaMetodoPago: "PPD",
    rfc: "ABC010101AB1",
    cp: "06600",
    regimen: "601",
    formaPago: "03",
    monto: 1000,
    moneda: "MXN",
    tipoCambio: 1,
  };

  it("acepta todos los checks cuando los datos son válidos", () => {
    const r = buildChecksRep(baseOk);
    expect(r.puedeTimbrar).toBe(true);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });

  it("falla si la factura no está timbrada", () => {
    const r = buildChecksRep({ ...baseOk, facturaUuid: null });
    expect(r.puedeTimbrar).toBe(false);
  });

  it("falla si la factura no es PPD", () => {
    const r = buildChecksRep({ ...baseOk, facturaMetodoPago: "PUE" });
    expect(r.puedeTimbrar).toBe(false);
  });

  it("falla si el CP no tiene 5 dígitos", () => {
    const r = buildChecksRep({ ...baseOk, cp: "123" });
    expect(r.puedeTimbrar).toBe(false);
  });

  it("requiere tipo de cambio cuando moneda ≠ MXN", () => {
    const r = buildChecksRep({ ...baseOk, moneda: "USD", tipoCambio: 0 });
    expect(r.puedeTimbrar).toBe(false);
  });

  it("acepta USD con tipo de cambio > 0", () => {
    const r = buildChecksRep({ ...baseOk, moneda: "USD", tipoCambio: 18.5 });
    expect(r.puedeTimbrar).toBe(true);
  });
});
