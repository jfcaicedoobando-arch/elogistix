import { describe, it, expect } from "vitest";
import { roleSatisfies } from "@/lib/auth/roleHierarchy";

/**
 * v13.54.0 — Bloque Q
 * La separación de roles del ciclo financiero NO debe permitir que un rol
 * cubra el trabajo de otro fuera de su escalera.
 */
describe("roleHierarchy: Bloque Q", () => {
  it("ejecutivo_cobranza NO satisface contador", () => {
    expect(roleSatisfies("contador", "ejecutivo_cobranza")).toBe(false);
  });

  it("auxiliar_contable NO satisface tesorero", () => {
    expect(roleSatisfies("tesorero", "auxiliar_contable")).toBe(false);
  });

  it("auxiliar_contable satisface contador (escalera contable)", () => {
    expect(roleSatisfies("contador", "auxiliar_contable")).toBe(true);
  });

  it("tesorero NO satisface contador ni auxiliar_contable", () => {
    expect(roleSatisfies("contador", "tesorero")).toBe(false);
    expect(roleSatisfies("auxiliar_contable", "tesorero")).toBe(false);
  });

  it("contador NO satisface tesorero (no paga)", () => {
    expect(roleSatisfies("tesorero", "contador")).toBe(false);
  });

  it("ejecutivo_cobranza y auxiliar_contable caen en viewer", () => {
    expect(roleSatisfies("viewer", "ejecutivo_cobranza")).toBe(true);
    expect(roleSatisfies("viewer", "auxiliar_contable")).toBe(true);
  });

  it("admin_org y super_admin satisfacen los 4 roles financieros", () => {
    for (const required of ["contador", "tesorero", "auxiliar_contable", "ejecutivo_cobranza"] as const) {
      expect(roleSatisfies(required, "admin_org")).toBe(true);
      expect(roleSatisfies(required, "super_admin")).toBe(true);
    }
  });

  it("operador NO satisface ningún rol financiero", () => {
    for (const required of ["contador", "tesorero", "auxiliar_contable", "ejecutivo_cobranza"] as const) {
      expect(roleSatisfies(required, "operador")).toBe(false);
    }
  });
});
