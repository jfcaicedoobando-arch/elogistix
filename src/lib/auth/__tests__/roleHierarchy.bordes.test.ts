import { describe, it, expect } from "vitest";
import { roleSatisfies, anyRoleSatisfies } from "@/lib/auth/roleHierarchy";
import type { AppRole } from "@/types/appRole";

describe("roleHierarchy.extra", () => {
  // ── roleSatisfies ──────────────────────────────────────────────────────────
  it("roleSatisfies: super_admin satisface super_admin", () => {
    expect(roleSatisfies("super_admin", "super_admin")).toBe(true);
  });

  it("roleSatisfies: super_admin satisface requerido admin", () => {
    expect(roleSatisfies("admin", "super_admin")).toBe(true);
  });

  it("roleSatisfies: super_admin satisface requerido operador", () => {
    expect(roleSatisfies("operador", "super_admin")).toBe(true);
  });

  it("roleSatisfies: super_admin satisface requerido viewer", () => {
    expect(roleSatisfies("viewer", "super_admin")).toBe(true);
  });

  it("roleSatisfies: admin_org satisface requerido admin", () => {
    expect(roleSatisfies("admin", "admin_org")).toBe(true);
  });

  it("roleSatisfies: operador NO satisface requerido admin", () => {
    expect(roleSatisfies("admin", "operador")).toBe(false);
  });

  it("roleSatisfies: viewer satisface requerido viewer con rol vendedor", () => {
    expect(roleSatisfies("viewer", "vendedor")).toBe(true);
  });

  it("roleSatisfies: viewer satisface requerido viewer con rol contador", () => {
    expect(roleSatisfies("viewer", "contador")).toBe(true);
  });

  it("roleSatisfies: coordinador_logistico NO satisface requerido admin", () => {
    expect(roleSatisfies("admin", "coordinador_logistico")).toBe(false);
  });

  it("roleSatisfies: cliente solo satisface requerido cliente", () => {
    expect(roleSatisfies("cliente", "cliente")).toBe(true);
    expect(roleSatisfies("viewer", "cliente")).toBe(false);
  });

  it("roleSatisfies: vendedor satisface requerido vendedor", () => {
    expect(roleSatisfies("vendedor", "vendedor")).toBe(true);
  });

  it("roleSatisfies: admin_org satisface requerido vendedor", () => {
    expect(roleSatisfies("vendedor", "admin_org")).toBe(true);
  });

  it("roleSatisfies: ejecutivo_pricing satisface requerido operador", () => {
    expect(roleSatisfies("operador", "ejecutivo_pricing")).toBe(true);
  });

  it("roleSatisfies: gerente_visor NO satisface requerido operador", () => {
    expect(roleSatisfies("operador", "gerente_visor")).toBe(false);
  });

  // ── anyRoleSatisfies ────────────────────────────────────────────────────────
  it("anyRoleSatisfies: pasa si satisface al menos uno de los requeridos", () => {
    const allowed: readonly AppRole[] = ["admin", "operador"];
    expect(anyRoleSatisfies(allowed, "admin_org")).toBe(true);
  });

  it("anyRoleSatisfies: falla si no satisface ninguno", () => {
    const allowed: readonly AppRole[] = ["super_admin", "admin"];
    expect(anyRoleSatisfies(allowed, "cliente")).toBe(false);
  });

  it("anyRoleSatisfies: lista vacía siempre retorna false", () => {
    expect(anyRoleSatisfies([], "super_admin")).toBe(false);
  });

  it("anyRoleSatisfies: viewer con rol gerente_operaciones satisface operador o viewer", () => {
    const allowed: readonly AppRole[] = ["operador", "viewer"];
    expect(anyRoleSatisfies(allowed, "gerente_operaciones")).toBe(true);
  });
});
