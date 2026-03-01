import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BitacoraActividad } from "@/components/BitacoraActividad";
import type { EntradaBitacora } from "@/hooks/useBitacora";

const entrada = (overrides: Partial<EntradaBitacora> = {}): EntradaBitacora => ({
  id: "1",
  usuario_id: "u1",
  usuario_email: "admin@test.com",
  accion: "crear",
  modulo: "embarques",
  entidad_id: "e1",
  entidad_nombre: "EXP-001",
  detalles: {},
  created_at: new Date().toISOString(),
  ...overrides,
});

describe("BitacoraActividad", () => {
  it("muestra mensaje vacío sin actividades", () => {
    render(<BitacoraActividad actividades={[]} />);
    expect(screen.getByText("Sin actividad registrada")).toBeInTheDocument();
  });

  it("renderiza entradas con acción y módulo", () => {
    render(
      <MemoryRouter>
        <BitacoraActividad actividades={[entrada()]} />
      </MemoryRouter>
    );
    expect(screen.getByText("embarques")).toBeInTheDocument();
  });

  it("oculta usuario cuando mostrarUsuario=false", () => {
    render(
      <MemoryRouter>
        <BitacoraActividad actividades={[entrada()]} mostrarUsuario={false} />
      </MemoryRouter>
    );
    expect(screen.queryByText("admin")).not.toBeInTheDocument();
  });

  it("genera link navegable a entidad", () => {
    render(
      <MemoryRouter>
        <BitacoraActividad actividades={[entrada()]} />
      </MemoryRouter>
    );
    const link = screen.getByText("EXP-001");
    expect(link.closest("a")).toHaveAttribute("href", "/embarques/e1");
  });

  it("no genera link si módulo no tiene ruta", () => {
    render(
      <MemoryRouter>
        <BitacoraActividad actividades={[entrada({ modulo: "otro" })]} />
      </MemoryRouter>
    );
    const nombre = screen.getByText("EXP-001");
    expect(nombre.closest("a")).toBeNull();
  });
});
