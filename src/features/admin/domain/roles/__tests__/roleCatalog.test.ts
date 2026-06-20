import { describe, it, expect } from "vitest";
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_BADGE_CLASSES,
  ASSIGNABLE_ROLES_ADMIN_ORG,
  LEGACY_ROLES,
  getRoleLabel,
} from "@/features/admin/domain/roles/roleCatalog";
import type { AppRole } from "@/types/appRole";

describe("roleCatalog", () => {
  it("expone label, descripción y badge para cada rol moderno y legacy", () => {
    const roles: AppRole[] = [
      "super_admin",
      "admin_org",
      "gerente_operaciones",
      "gerente_visor",
      "gerente_comercial",
      "coordinador_logistico",
      "ejecutivo_pricing",
      "contador",
      "tesorero",
      "auxiliar_contable",
      "ejecutivo_cobranza",
      "vendedor",
      "customer_service",
      "cliente",
      "admin",
      "operador",
      "viewer",
    ];
    for (const r of roles) {
      expect(typeof ROLE_LABELS[r]).toBe("string");
      expect(ROLE_LABELS[r].length).toBeGreaterThanOrEqual(3);
      expect(typeof ROLE_DESCRIPTIONS[r]).toBe("string");
      expect(ROLE_DESCRIPTIONS[r].length).toBeGreaterThanOrEqual(10);
      expect(ROLE_BADGE_CLASSES[r]).toMatch(/bg-/);
      expect(ROLE_BADGE_CLASSES[r]).toMatch(/text-/);
    }
  });

  it("ASSIGNABLE_ROLES_ADMIN_ORG no incluye super_admin, cliente ni legacy", () => {
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).not.toContain("super_admin");
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).not.toContain("cliente");
    for (const legacy of LEGACY_ROLES) {
      expect(ASSIGNABLE_ROLES_ADMIN_ORG).not.toContain(legacy);
    }
  });

  it("ASSIGNABLE_ROLES_ADMIN_ORG contiene exactamente los 12 roles modernos asignables", () => {
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).toHaveLength(12);
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).toContain("admin_org");
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).toContain("vendedor");
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).toContain("gerente_comercial");
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).toContain("contador");
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).toContain("auxiliar_contable");
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).toContain("ejecutivo_cobranza");
  });

  it("LEGACY_ROLES incluye admin/operador/viewer", () => {
    expect(LEGACY_ROLES).toEqual(["admin", "operador", "viewer"]);
  });

  it("getRoleLabel devuelve '—' para null/undefined/vacío", () => {
    expect(getRoleLabel(null)).toBe("—");
    expect(getRoleLabel(undefined)).toBe("—");
    expect(getRoleLabel("")).toBe("—");
  });

  it("getRoleLabel devuelve la etiqueta del catálogo para un rol válido", () => {
    expect(getRoleLabel("admin_org")).toBe("Administrador");
    expect(getRoleLabel("super_admin")).toBe("Super Admin");
  });

  it("getRoleLabel devuelve el string crudo si el rol es desconocido", () => {
    expect(getRoleLabel("rol_inexistente")).toBe("rol_inexistente");
  });
});
