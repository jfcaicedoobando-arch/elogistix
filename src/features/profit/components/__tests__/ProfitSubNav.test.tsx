/**
 * ProfitSubNav — verifica que las 4 rutas del módulo se listen y que la
 * ruta activa reciba la clase `border-primary`. Fase 4 UI/UX.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProfitSubNav } from "../ProfitSubNav";

function setup(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <ProfitSubNav />
    </MemoryRouter>,
  );
}

describe("ProfitSubNav", () => {
  it("renderiza las 4 rutas del módulo Profit", () => {
    setup("/profit/dashboard");
    expect(screen.getByRole("link", { name: /Dashboard Ejecutivo/i })).toHaveAttribute("href", "/profit/dashboard");
    expect(screen.getByRole("link", { name: /Proyección/i })).toHaveAttribute("href", "/profit/proyeccion");
    expect(screen.getByRole("link", { name: /Estado de Resultados/i })).toHaveAttribute("href", "/profit/estado-resultados");
    expect(screen.getByRole("link", { name: /Presupuesto vs Real/i })).toHaveAttribute("href", "/profit/presupuesto");
  });

  it("marca la ruta activa con border-primary", () => {
    setup("/profit/presupuesto");
    const activo = screen.getByRole("link", { name: /Presupuesto vs Real/i });
    expect(activo.className).toContain("border-primary");
    const inactivo = screen.getByRole("link", { name: /Dashboard Ejecutivo/i });
    expect(inactivo.className).toContain("border-transparent");
  });
});
