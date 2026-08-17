import { describe, it, expect } from "vitest";
import { resolveSinAccesoVariant, esRolAdministrador } from "../resolveSinAccesoVariant";

describe("resolveSinAccesoVariant", () => {
  it("prioriza error-carga sobre cualquier otro motivo", () => {
    expect(resolveSinAccesoVariant({ motivo: "error-carga", effectiveRole: "admin_org" })).toBe("error-carga");
    expect(resolveSinAccesoVariant({ motivo: "error-carga", effectiveRole: null })).toBe("error-carga");
  });

  it("permiso-modulo requiere un rol efectivo", () => {
    expect(resolveSinAccesoVariant({ motivo: "permiso-modulo", effectiveRole: "admin_org" })).toBe("permiso-modulo");
    expect(resolveSinAccesoVariant({ motivo: "permiso-modulo", effectiveRole: null })).toBe("sin-rol-org");
  });

  it("por defecto es sin-rol-org", () => {
    expect(resolveSinAccesoVariant({})).toBe("sin-rol-org");
    expect(resolveSinAccesoVariant({ motivo: undefined, effectiveRole: null })).toBe("sin-rol-org");
  });
});

describe("esRolAdministrador", () => {
  it("reconoce admin_org y super_admin", () => {
    expect(esRolAdministrador("admin_org")).toBe(true);
    expect(esRolAdministrador("super_admin")).toBe(true);
  });

  it("rechaza otros roles y nulos", () => {
    expect(esRolAdministrador("viewer")).toBe(false);
    expect(esRolAdministrador(null)).toBe(false);
    expect(esRolAdministrador(undefined)).toBe(false);
  });
});
