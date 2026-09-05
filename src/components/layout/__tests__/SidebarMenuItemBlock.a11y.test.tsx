/**
 * Regresión de accesibilidad: el badge de alertas del sidebar debe anunciar
 * "1 alerta" / "2 alertas", no "2 alertas" para el singular.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarMenuItemBlock } from "@/components/layout/SidebarMenuItemBlock";
import type { SidebarItem } from "@/components/layout/sidebarActivo";

const ITEM = (badgeCount: number): SidebarItem => ({
  title: "Inicio",
  url: "/",
  icon: Home,
  badgeCount,
});

const renderItem = (badgeCount: number, collapsed = false) =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <TooltipProvider>
        <SidebarMenuItemBlock
          item={ITEM(badgeCount)}
          items={[ITEM(badgeCount)]}
          pathname="/"
          search=""
          collapsed={collapsed}
          onNavigate={vi.fn()}
        />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe("SidebarMenuItemBlock · accesibilidad", () => {
  it("anuncia '1 alerta' cuando hay una sola alerta", () => {
    renderItem(1);
    expect(screen.getByLabelText("1 alerta")).toBeInTheDocument();
  });

  it("anuncia '2 alertas' cuando hay varias alertas", () => {
    renderItem(2);
    expect(screen.getByLabelText("2 alertas")).toBeInTheDocument();
  });

  it("en modo colapsado el dot también pluraliza correctamente", () => {
    renderItem(1, true);
    expect(screen.getByLabelText("1 alerta activa")).toBeInTheDocument();
  });
});
