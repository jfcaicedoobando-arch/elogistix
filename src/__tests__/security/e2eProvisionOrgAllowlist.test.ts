import { describe, expect, it } from "vitest";
import {
  nombreOrgPermitido,
  parseOrgAllowlist,
  primerNombreOrgNoPermitido,
} from "../../../supabase/functions/e2e-provision-multi-tenant/orgNameAllowlist";

describe("P3 · allowlist de nombres de org E2E (multi-tenant)", () => {
  it("acepta los nombres por defecto del spec 26-multi-tenant-isolation", () => {
    expect(nombreOrgPermitido("E2E Multi-Tenant A")).toBe(true);
    expect(nombreOrgPermitido("E2E Multi-Tenant B")).toBe(true);
    expect(nombreOrgPermitido("e2e-pipeline-qa")).toBe(true);
    expect(nombreOrgPermitido("TEST-Smoke Org")).toBe(true);
  });

  it("rechaza nombres de orgs reales (el cleanup ya no puede borrarlas)", () => {
    expect(nombreOrgPermitido("ACME SA de CV")).toBe(false);
    expect(nombreOrgPermitido("Libre Carga")).toBe(false);
    expect(nombreOrgPermitido("Elogistix Demo")).toBe(false);
  });

  it("exige separador tras el prefijo (Testers Unidos / E2Ecommerce no pasan)", () => {
    expect(nombreOrgPermitido("Testers Unidos SA")).toBe(false);
    expect(nombreOrgPermitido("E2Ecommerce SA")).toBe(false);
    expect(nombreOrgPermitido("test")).toBe(false);
  });

  it("rechaza entradas vacías", () => {
    expect(nombreOrgPermitido("")).toBe(false);
    expect(nombreOrgPermitido("   ")).toBe(false);
  });

  it("cuando hay allowlist configurada, reemplaza a los prefijos por defecto", () => {
    const allow = "QA Staging, Smoke-";
    expect(nombreOrgPermitido("QA Staging Tenant 1", allow)).toBe(true);
    expect(nombreOrgPermitido("Smoke-tenant-9", allow)).toBe(true);
    // La allowlist explícita reemplaza a los prefijos por defecto.
    expect(nombreOrgPermitido("E2E Multi-Tenant A", allow)).toBe(false);
    expect(nombreOrgPermitido("ACME SA", allow)).toBe(false);
  });

  it("parseOrgAllowlist normaliza separadores y mayúsculas", () => {
    expect(parseOrgAllowlist(" QA Staging ;Smoke-\nQA_B2B ")).toEqual([
      "qa staging",
      "smoke-",
      "qa_b2b",
    ]);
    expect(parseOrgAllowlist(undefined)).toEqual([]);
  });

  it("primerNombreOrgNoPermitido reporta el primer rechazo e ignora vacíos", () => {
    expect(
      primerNombreOrgNoPermitido([null, "E2E Multi-Tenant A", undefined]),
    ).toBeNull();
    expect(
      primerNombreOrgNoPermitido(["E2E Multi-Tenant A", "ACME SA"]),
    ).toBe("ACME SA");
  });
});
