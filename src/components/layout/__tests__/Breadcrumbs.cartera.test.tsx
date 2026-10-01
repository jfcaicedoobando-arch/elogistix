import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Breadcrumbs } from "../Breadcrumbs";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("Breadcrumbs — contexto de Cartera", () => {
  it.each([
    ["/reportes/cartera", "Cartera y antigüedad"],
    ["/cartera", "Cobranza"],
    ["/cobranza", "Cobranza"],
  ])("%s conserva su nombre de negocio", (ruta, etiqueta) => {
    render(<MemoryRouter initialEntries={[ruta]}><TooltipProvider><Breadcrumbs /></TooltipProvider></MemoryRouter>);
    const nav = screen.getByRole("navigation", { name: "Migas de pan" });
    expect(within(nav).getByText(etiqueta)).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/inicio");
  });
});
