import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AprobarProveedorButton } from "../AprobarProveedorButton";
import { ProveedoresProvisionalesAviso } from "../ProveedoresProvisionalesAviso";

const mocks = vi.hoisted(() => ({
  pending: false,
  data: [] as { id: string; nombre: string }[],
  mutate: vi.fn(),
  aprobar: vi.fn(),
}));
vi.mock("@/features/proveedor/hooks/useProveedoresProvisionales", () => ({
  useProveedoresProvisionales: () => ({ data: mocks.data }),
  useAprobarProveedorProvisional: (id: string) => {
    mocks.aprobar(id);
    return { isPending: mocks.pending, mutate: mocks.mutate };
  },
}));
beforeEach(() => { vi.clearAllMocks(); mocks.pending = false; mocks.data = []; });

describe("presentación de proveedores provisionales", () => {
  it("omite el aviso si no hay pendientes", () => {
    render(<ProveedoresProvisionalesAviso />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("usa Alert canónico y conserva el enlace individual de cada proveedor", () => {
    mocks.data = [{ id: "p1", nombre: "Agente uno" }, { id: "p2", nombre: "Agente dos" }];
    render(<MemoryRouter><ProveedoresProvisionalesAviso /></MemoryRouter>);
    expect(screen.getByRole("alert")).toHaveTextContent("Provisionales por aprobar (2)");
    expect(screen.getByRole("link", { name: "Agente uno" })).toHaveAttribute("href", "/proveedores/p1");
    expect(screen.getByRole("link", { name: "Agente dos" })).toHaveAttribute("href", "/proveedores/p2");
  });

  it("pasa el id al hook y bloquea clics repetidos durante la aprobación", () => {
    const view = render(<AprobarProveedorButton proveedorId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: "Aprobar como proveedor" }));
    expect(mocks.aprobar).toHaveBeenCalledWith("p1");
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    mocks.pending = true;
    view.rerender(<AprobarProveedorButton proveedorId="p1" />);
    const button = screen.getByRole("button", { name: "Aprobar como proveedor" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });
});
