/**
 * Aviso de proveedor Naviera faltante: el agente sólo recibe explicación
 * (sin CTA a módulos sin permiso); el gerente de operaciones recibe el CTA
 * al directorio de proveedores filtrado por tipo Naviera.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NavieraProveedorAlerta } from "../NavieraProveedorAlerta";

vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/lib/contexts/AuthContext";
const mockUseAuth = vi.mocked(useAuth);
type Auth = ReturnType<typeof useAuth>;

function renderConRol(rol: string) {
  mockUseAuth.mockReturnValue({ role: rol, effectiveRole: rol } as Partial<Auth> as Auth);
  return render(
    <MemoryRouter>
      <NavieraProveedorAlerta />
    </MemoryRouter>,
  );
}

describe("NavieraProveedorAlerta", () => {
  it("gerente_operaciones ve el CTA al directorio filtrado por tipo Naviera", () => {
    renderConRol("gerente_operaciones");
    const cta = screen.getByRole("link", { name: /Crear proveedor Naviera/i });
    expect(cta).toHaveAttribute("href", expect.stringContaining("tipo=Naviera"));
  });

  it("el agente no ve CTA y sí la instrucción de pedirlo a Operaciones", () => {
    renderConRol("agente");
    expect(screen.queryByRole("link", { name: /Crear proveedor Naviera/i })).toBeNull();
    expect(screen.getByText(/Pide a Operaciones/i)).toBeTruthy();
  });
});
