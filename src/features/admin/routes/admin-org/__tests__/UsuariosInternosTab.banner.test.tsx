/**
 * P-09 — Banner persistente cuando la edge function `user-management` no
 * resuelve los correos. Verifica que se muestre sólo cuando hay placeholders
 * y que el botón "Reintentar" dispare un refetch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario/constants";

const mocks = vi.hoisted(() => ({
  usuarios: [] as Array<{ user_id: string; email: string; role: string }>,
  refetch: vi.fn(),
  reportCaughtError: vi.fn(),
}));

vi.mock("@/features/admin/hooks/usuario", () => ({
  useUsuarios: () => ({
    data: mocks.usuarios,
    isLoading: false,
    isFetching: false,
    refetch: mocks.refetch,
  }),
  useUpdateUserRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-admin" } }),
}));

vi.mock("@/lib/observability/reportCaughtError", () => ({
  reportCaughtError: mocks.reportCaughtError,
}));

// La tabla y la toolbar tienen dependencias propias fuera del alcance.
vi.mock("@/components/shared/DataTable", () => ({
  DataTable: () => null,
}));
vi.mock("../UsuariosToolbar", () => ({
  TODOS: "todos",
  UsuariosToolbar: () => null,
}));
vi.mock("../usuariosColumns", () => ({
  useUsuarioColumns: () => [],
}));

import { UsuariosInternosTab } from "../UsuariosInternosTab";

describe("UsuariosInternosTab — banner de correos sin resolver (P-09)", () => {
  beforeEach(() => {
    mocks.refetch.mockClear();
    mocks.reportCaughtError.mockClear();
  });

  it("no muestra el banner cuando todos los correos se resolvieron", () => {
    mocks.usuarios = [{ user_id: "u1", email: "ana@empresa.mx", role: "operativo" }];
    render(<UsuariosInternosTab />);

    expect(screen.queryByText(/No se pudieron cargar los correos/i)).toBeNull();
    expect(mocks.reportCaughtError).not.toHaveBeenCalled();
  });

  it("muestra el banner y reporta a observabilidad cuando hay placeholders", () => {
    mocks.usuarios = [
      { user_id: "u1", email: UNRESOLVED_EMAIL, role: "operativo" },
      { user_id: "u2", email: "ana@empresa.mx", role: "admin" },
    ];
    render(<UsuariosInternosTab />);

    expect(screen.getByText(/No se pudieron cargar los correos/i)).toBeInTheDocument();
    expect(screen.getByText(/1 usuario\(s\) se muestran sin correo/i)).toBeInTheDocument();
    expect(mocks.reportCaughtError).toHaveBeenCalledTimes(1);
  });

  it("el botón Reintentar vuelve a consultar la lista", () => {
    mocks.usuarios = [{ user_id: "u1", email: UNRESOLVED_EMAIL, role: "operativo" }];
    render(<UsuariosInternosTab />);

    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
