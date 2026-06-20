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

const ALL_ROLES: AppRole[] = [
  "super_admin", "admin_org", "gerente_operaciones", "gerente_visor", "gerente_comercial",
  "coordinador_logistico", "ejecutivo_pricing", "contador", "tesorero",
  "auxiliar_contable", "ejecutivo_cobranza",
  "vendedor", "customer_service", "cliente", "admin", "operador", "viewer",
];

describe("roleCatalog | ROLE_LABELS", () => {
  it("tiene una etiqueta para cada rol", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABELS[role], `Falta etiqueta para ${role}`).toBeTruthy();
    }
  });

  it("super_admin tiene etiqueta 'Super Admin'", () => {
    expect(ROLE_LABELS["super_admin"]).toBe("Super Admin");
  });

  it("admin_org tiene etiqueta 'Administrador'", () => {
    expect(ROLE_LABELS["admin_org"]).toBe("Administrador");
  });

  it("roles legacy tienen indicación de legacy en su etiqueta", () => {
    expect(ROLE_LABELS["admin"]).toMatch(/legacy/i);
    expect(ROLE_LABELS["operador"]).toMatch(/legacy/i);
    expect(ROLE_LABELS["viewer"]).toMatch(/legacy/i);
  });

  it("cubre exactamente el número total de roles conocidos", () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(ALL_ROLES.length);
  });
});

describe("roleCatalog | ROLE_DESCRIPTIONS", () => {
  it("tiene descripción para todos los roles", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_DESCRIPTIONS[role], `Falta descripción para ${role}`).toBeTruthy();
    }
  });

  it("super_admin menciona acceso total", () => {
    expect(ROLE_DESCRIPTIONS["super_admin"]).toMatch(/acceso total/i);
  });

  it("cliente tiene descripción de portal restringido", () => {
    expect(ROLE_DESCRIPTIONS["cliente"]).toMatch(/portal/i);
  });

  it("cada descripción tiene al menos 10 caracteres", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_DESCRIPTIONS[role].length, `Descripción demasiado corta para ${role}`).toBeGreaterThan(10);
    }
  });
});

describe("roleCatalog | ROLE_BADGE_CLASSES", () => {
  it("tiene clases de badge para todos los roles", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_BADGE_CLASSES[role], `Falta badge class para ${role}`).toBeTruthy();
    }
  });

  it("todas las clases contienen bg- y text-", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_BADGE_CLASSES[role]).toMatch(/bg-/);
      expect(ROLE_BADGE_CLASSES[role]).toMatch(/text-/);
    }
  });

  it("super_admin usa clases de primary", () => {
    expect(ROLE_BADGE_CLASSES["super_admin"]).toContain("bg-primary");
  });
});

describe("roleCatalog | ASSIGNABLE_ROLES_ADMIN_ORG", () => {
  it("no contiene roles legacy", () => {
    for (const legacy of LEGACY_ROLES) {
      expect(ASSIGNABLE_ROLES_ADMIN_ORG).not.toContain(legacy);
    }
  });

  it("no contiene super_admin", () => {
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).not.toContain("super_admin");
  });

  it("no contiene cliente", () => {
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).not.toContain("cliente");
  });

  it("contiene admin_org", () => {
    expect(ASSIGNABLE_ROLES_ADMIN_ORG).toContain("admin_org");
  });

  it("contiene todos los roles operativos clave", () => {
    const esperados: AppRole[] = ["coordinador_logistico", "contador", "tesorero", "vendedor"];
    for (const r of esperados) {
      expect(ASSIGNABLE_ROLES_ADMIN_ORG).toContain(r);
    }
  });

  it("es un array de solo lectura (readonly)", () => {
    expect(Array.isArray(ASSIGNABLE_ROLES_ADMIN_ORG)).toBe(true);
  });
});

describe("roleCatalog | LEGACY_ROLES", () => {
  it("contiene exactamente 3 roles legacy", () => {
    expect(LEGACY_ROLES).toHaveLength(3);
  });

  it("incluye admin, operador y viewer", () => {
    expect(LEGACY_ROLES).toContain("admin");
    expect(LEGACY_ROLES).toContain("operador");
    expect(LEGACY_ROLES).toContain("viewer");
  });
});

describe("roleCatalog | getRoleLabel", () => {
  it("retorna '—' para null", () => {
    expect(getRoleLabel(null)).toBe("—");
  });

  it("retorna '—' para undefined", () => {
    expect(getRoleLabel(undefined)).toBe("—");
  });

  it("retorna '—' para string vacío", () => {
    expect(getRoleLabel("")).toBe("—");
  });

  it("retorna la etiqueta del catálogo para un rol conocido", () => {
    expect(getRoleLabel("contador")).toBe("Contador");
  });

  it("retorna el rol tal cual si no está en el catálogo", () => {
    expect(getRoleLabel("rol_desconocido")).toBe("rol_desconocido");
  });

  it("funciona correctamente para todos los roles definidos", () => {
    for (const role of ALL_ROLES) {
      expect(getRoleLabel(role)).toBe(ROLE_LABELS[role]);
    }
  });

  it("devuelve la etiqueta correcta para super_admin", () => {
    expect(getRoleLabel("super_admin")).toBe("Super Admin");
  });
});
