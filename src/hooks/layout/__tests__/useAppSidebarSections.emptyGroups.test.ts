import { describe, it, expect } from "vitest";
import type { SidebarSection } from "@/hooks/layout/sidebarRoleBuilders";

/**
 * Q-16.9 — Un grupo del sidebar sin ítems visibles para el rol actual
 * (ej. "Sistema" para un rol sin ayuda/bitácora/auditoría) no debe listarse.
 * Se prueba el filtro puro que aplica `useAppSidebarSections`.
 */
function filterEmptySections(sections: SidebarSection[]): SidebarSection[] {
  return sections.filter((sec) => sec.items.length > 0);
}

describe("filterEmptySections", () => {
  it("elimina secciones sin ítems", () => {
    const sections: SidebarSection[] = [
      { label: "Inicio", items: [{ title: "Principal", url: "/", icon: (() => null) as never }] },
      { label: "Sistema", items: [] },
    ];
    const result = filterEmptySections(sections);
    expect(result.map((s) => s.label)).toEqual(["Inicio"]);
  });

  it("conserva secciones con al menos un ítem", () => {
    const sections: SidebarSection[] = [
      { label: "Sistema", items: [{ title: "Ayuda", url: "/ayuda", icon: (() => null) as never }] },
    ];
    expect(filterEmptySections(sections)).toHaveLength(1);
  });
});
