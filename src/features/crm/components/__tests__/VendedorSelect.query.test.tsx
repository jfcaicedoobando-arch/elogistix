import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VendedorSelect from "../VendedorSelect";

const mocks = vi.hoisted(() => ({ permite: false, usuarios: vi.fn() }));
vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canReasignarVendedorCrm: mocks.permite }) }));
vi.mock("@/features/admin/hooks/usuario", () => ({ useUsuarios: mocks.usuarios }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permite = false;
  mocks.usuarios.mockReturnValue({ data: [] });
});

describe("selector oculto no solicita el catálogo administrativo", () => {
  it("KAM/vendedor deshabilita la consulta además de ocultar el campo", () => {
    render(<VendedorSelect value={null} onChange={vi.fn()} />);
    expect(mocks.usuarios).toHaveBeenCalledWith({ enabled: false });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("con capacidad habilita la consulta y muestra el selector", () => {
    mocks.permite = true;
    render(<VendedorSelect value={null} onChange={vi.fn()} />);
    expect(mocks.usuarios).toHaveBeenCalledWith({ enabled: true });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
