import { describe, it, expect } from "vitest";
import { adminGroups } from "@/features/admin/components/adminSidebarGroups";

/**
 * Q-16 — Seguridad de navegación: el sidebar de Admin no debe listar grupos
 * sin ítems visibles (un grupo vacío confundiría al usuario y sugeriría un
 * bug de permisos/config). Verifica la config estática usada por el render.
 */
describe("AdminSidebar — grupos", () => {
  it("ningún grupo declarado está vacío", () => {
    expect(adminGroups.length).toBeGreaterThan(0);
    for (const group of adminGroups) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it("todas las URLs de los ítems son únicas", () => {
    const urls = adminGroups.flatMap((g) => g.items.map((i) => i.url));
    expect(new Set(urls).size).toBe(urls.length);
  });
});
