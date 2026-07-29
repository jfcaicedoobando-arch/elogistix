import { describe, it, expect } from "vitest";
import { ROLE_BUILDERS, buildAdmin, filterSectionsByRole } from "@/hooks/layout/sidebarRoleBuilders";
import { hasRouteAccess } from "@/lib/access/roleRouteMatrix";
import { SIDEBAR_CRM_ITEMS, SIDEBAR_SISTEMA_ITEMS } from "@/components/layout/sidebarItems";
import type { AppRole } from "@/types/appRole";

/**
 * Q-16 (2) — Consistencia sidebar↔matriz: todo ítem que un builder de rol
 * expone debe tener acceso permitido según `roleRouteMatrix`, y el filtro
 * (`filterSectionsByRole`) nunca deja pasar uno que la matriz prohíbe.
 */
const deps = { crmItems: SIDEBAR_CRM_ITEMS, sistemaItems: SIDEBAR_SISTEMA_ITEMS };
const roles: AppRole[] = [...Object.keys(ROLE_BUILDERS) as AppRole[], "super_admin"];

describe("sidebar ↔ roleRouteMatrix", () => {
  it.each(roles)("los ítems visibles para %s tienen acceso permitido en la matriz", (role) => {
    const builder = ROLE_BUILDERS[role] ?? buildAdmin;
    const sections = builder(deps);
    for (const sec of sections) {
      for (const item of sec.items) {
        expect(hasRouteAccess(role, item.url)).toBe(true);
      }
    }
  });

  it("filterSectionsByRole elimina ítems no permitidos para el rol", () => {
    const sections = [{ label: "Dinero", items: SIDEBAR_SISTEMA_ITEMS }];
    const filtered = filterSectionsByRole(sections, "vendedor");
    for (const sec of filtered) {
      for (const item of sec.items) {
        expect(hasRouteAccess("vendedor", item.url)).toBe(true);
      }
    }
  });
});
