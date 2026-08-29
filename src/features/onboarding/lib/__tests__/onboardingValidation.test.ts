import { describe, expect, it } from "vitest";
import { validateOnboarding } from "../onboardingValidation";

const base = { direccion: "Av. Siempre Viva 123, CDMX", moneda: "MXN", skipFiscal: false };

describe("validateOnboarding (B-20 · RFC con formato SAT)", () => {
  it("acepta RFC de persona moral (12) y persona física (13)", () => {
    expect(validateOnboarding({ ...base, rfc: "ABC010203XY4" })).toMatchObject({ ok: true });
    expect(validateOnboarding({ ...base, rfc: "MABJ850312XY4" })).toMatchObject({ ok: true });
  });

  it("normaliza a mayúsculas y recorta espacios", () => {
    const r = validateOnboarding({ ...base, rfc: "  abc010203xy4 " });
    expect(r).toMatchObject({ ok: true, rfc: "ABC010203XY4" });
  });

  it("exige el RFC cuando no se omiten los datos fiscales", () => {
    const r = validateOnboarding({ ...base, rfc: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/RFC/);
  });

  it("rechaza longitudes válidas pero con estructura inválida", () => {
    // 12-13 caracteres ya no basta: debe cumplir letras + fecha + homoclave.
    expect(validateOnboarding({ ...base, rfc: "123456789012" }).ok).toBe(false);
    expect(validateOnboarding({ ...base, rfc: "ABC990103XY4" }).ok).toBe(false); // mes 99
    expect(validateOnboarding({ ...base, rfc: "ABC010232XY4" }).ok).toBe(false); // día 32
    expect(validateOnboarding({ ...base, rfc: "ABC010203X!" }).ok).toBe(false); // homoclave inválida
  });

  it("con skipFiscal ignora RFC y dirección", () => {
    const r = validateOnboarding({ ...base, skipFiscal: true, rfc: "basura", direccion: "" });
    expect(r).toMatchObject({ ok: true, rfc: "", direccion: "" });
  });

  it("rechaza monedas fuera del catálogo", () => {
    expect(validateOnboarding({ ...base, rfc: "ABC010203XY4", moneda: "BTC" }).ok).toBe(false);
  });
});
