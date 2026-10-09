import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ResponsiveDataTable } from "../ResponsiveDataTable";

vi.mock("@/hooks/shared", () => ({ useIsMobile: () => true }));
const row = { id: "fixture", nombre: "Contenido visible" };

describe("ResponsiveDataTable · nombre accesible del botón móvil", () => {
  it("aplica getRowAriaLabel al botón y conserva el registro de onRowClick", () => {
    const onRowClick = vi.fn();
    render(<MemoryRouter><ResponsiveDataTable columns={[]} data={[row]} rowKey={(r) => r.id}
      mobileCard={(r) => <span>{r.nombre}</span>} onRowClick={onRowClick}
      getRowAriaLabel={(r) => `Abrir registro ${r.id}`} /></MemoryRouter>);
    const button = screen.getByRole("button", { name: "Abrir registro fixture" });
    expect(button).toHaveTextContent("Contenido visible");
    fireEvent.click(button);
    expect(onRowClick).toHaveBeenCalledOnce();
    expect(onRowClick).toHaveBeenCalledWith(row);
  });

  it("sin getRowAriaLabel conserva el nombre accesible derivado del contenido", () => {
    render(<MemoryRouter><ResponsiveDataTable columns={[]} data={[row]} rowKey={(r) => r.id}
      mobileCard={(r) => <span>{r.nombre}</span>} onRowClick={vi.fn()} /></MemoryRouter>);
    const button = screen.getByRole("button", { name: "Contenido visible" });
    expect(button).not.toHaveAttribute("aria-label");
  });

  it("con getRowHref conserva el nombre y el rol de enlace", () => {
    render(<MemoryRouter><ResponsiveDataTable columns={[]} data={[row]} rowKey={(r) => r.id}
      mobileCard={(r) => <span>{r.nombre}</span>} getRowHref={(r) => `/detalle/${r.id}`}
      getRowAriaLabel={(r) => `Abrir enlace ${r.id}`} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Abrir enlace fixture" })).toHaveTextContent("Contenido visible");
  });
});
