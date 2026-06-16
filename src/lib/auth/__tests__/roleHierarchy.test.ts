import { describe, it, expect } from "vitest";
import { roleSatisfies, anyRoleSatisfies } from "../roleHierarchy";

describe("roleSatisfies", () => {
  it("admin_org satisface 'admin' (requerido por /usuarios, /configuracion)", () => {
    expect(roleSatisfies("admin", "admin_org")).toBe(true);
  });

  it("super_admin satisface 'admin' y 'admin_org'", () => {
    expect(roleSatisfies("admin", "super_admin")).toBe(true);
    expect(roleSatisfies("admin_org", "super_admin")).toBe(true);
  });

  it("coordinador_logistico satisface 'operador'", () => {
    expect(roleSatisfies("operador", "coordinador_logistico")).toBe(true);
  });

  it("ejecutivo_pricing y gerente_operaciones satisfacen 'operador'", () => {
    expect(roleSatisfies("operador", "ejecutivo_pricing")).toBe(true);
    expect(roleSatisfies("operador", "gerente_operaciones")).toBe(true);
  });

  it("viewer acepta a casi todo el staff", () => {
    expect(roleSatisfies("viewer", "customer_service")).toBe(true);
    expect(roleSatisfies("viewer", "contador")).toBe(true);
    expect(roleSatisfies("viewer", "admin_org")).toBe(true);
  });

  it("super_admin sólo lo satisface super_admin", () => {
    expect(roleSatisfies("super_admin", "super_admin")).toBe(true);
    expect(roleSatisfies("super_admin", "admin_org")).toBe(false);
    expect(roleSatisfies("super_admin", "admin")).toBe(false);
  });

  it("cliente no satisface roles de staff", () => {
    expect(roleSatisfies("admin", "cliente")).toBe(false);
    expect(roleSatisfies("operador", "cliente")).toBe(false);
    expect(roleSatisfies("viewer", "cliente")).toBe(false);
  });

  it("vendedor agrupa con gerente_comercial, admin_org y super_admin", () => {
    expect(roleSatisfies("vendedor", "admin_org")).toBe(true);
    expect(roleSatisfies("vendedor", "super_admin")).toBe(true);
    expect(roleSatisfies("vendedor", "vendedor")).toBe(true);
    expect(roleSatisfies("vendedor", "gerente_comercial")).toBe(true);
    expect(roleSatisfies("vendedor", "contador")).toBe(false);
  });

  it("gerente_comercial satisface viewer pero no operador ni admin_org", () => {
    expect(roleSatisfies("viewer", "gerente_comercial")).toBe(true);
    expect(roleSatisfies("operador", "gerente_comercial")).toBe(false);
    expect(roleSatisfies("admin_org", "gerente_comercial")).toBe(false);
    expect(roleSatisfies("admin", "gerente_comercial")).toBe(false);
  });
});

describe("anyRoleSatisfies", () => {
  it("acepta si al menos uno se cumple", () => {
    expect(anyRoleSatisfies(["admin", "super_admin"], "admin_org")).toBe(true);
    expect(anyRoleSatisfies(["admin"], "admin_org")).toBe(true);
    expect(anyRoleSatisfies(["admin"], "operador")).toBe(false);
  });
});
