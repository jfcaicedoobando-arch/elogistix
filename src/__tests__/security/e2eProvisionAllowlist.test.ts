import { describe, expect, it } from "vitest";
import {
  emailPermitido,
  parseAllowlist,
  primerEmailNoPermitido,
} from "../../../supabase/functions/e2e-provision-users/emailAllowlist";

describe("A9 · allowlist de provisioning E2E", () => {
  it("acepta dominios de prueba por defecto", () => {
    expect(emailPermitido("qa.admin@e2e.local")).toBe(true);
    expect(emailPermitido("Portal@Example.com")).toBe(true);
  });

  it("rechaza cuentas reales cuando no hay allowlist configurada", () => {
    expect(emailPermitido("hlopezb@gmail.com")).toBe(false);
    expect(emailPermitido("hector@lopezbenavides.com")).toBe(false);
  });

  it("rechaza entradas inválidas", () => {
    expect(emailPermitido("")).toBe(false);
    expect(emailPermitido("sin-arroba")).toBe(false);
    expect(emailPermitido("nada@")).toBe(false);
  });

  it("cuando hay allowlist, sólo pasan sus emails y dominios", () => {
    const allow = "qa.admin@empresa.com, @staging.librecarga.test";
    expect(emailPermitido("qa.admin@empresa.com", allow)).toBe(true);
    expect(emailPermitido("otro@staging.librecarga.test", allow)).toBe(true);
    // La allowlist explícita reemplaza a los dominios por defecto.
    expect(emailPermitido("qa@e2e.local", allow)).toBe(false);
    expect(emailPermitido("intruso@empresa.com", allow)).toBe(false);
  });

  it("parseAllowlist normaliza separadores y mayúsculas", () => {
    expect(parseAllowlist(" A@B.com ;@C.dev\n@d.dev ")).toEqual([
      "a@b.com",
      "@c.dev",
      "@d.dev",
    ]);
    expect(parseAllowlist(undefined)).toEqual([]);
  });

  it("primerEmailNoPermitido reporta el primer rechazo e ignora vacíos", () => {
    expect(primerEmailNoPermitido([null, "qa@e2e.local", undefined])).toBeNull();
    expect(primerEmailNoPermitido(["qa@e2e.local", "real@gmail.com"])).toBe(
      "real@gmail.com",
    );
  });
});
