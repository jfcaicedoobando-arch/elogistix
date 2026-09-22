/**
 * P1 auditoría v13.824.3 — el portal del agente no debe quedarse en
 * "Verificando permisos…": al resolverse la sesión entra sin recargar y, si la
 * consulta de permisos falla, ofrece reintentar en lugar de un skeleton eterno.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const authMock = vi.fn();
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => authMock(),
}));

import { AgenteProtectedRoute } from "../AgenteProtectedRoute";

const base = {
  user: null as unknown,
  role: null as string | null,
  loading: true,
  profileError: false,
  refreshProfile: vi.fn(),
};

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/agente"]}>
      <AgenteProtectedRoute>
        <div>Panel del agente</div>
      </AgenteProtectedRoute>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authMock.mockReset();
  base.refreshProfile = vi.fn();
});

describe("AgenteProtectedRoute", () => {
  it("entra al portal cuando la sesión pasa de null a usuario agente", () => {
    authMock.mockReturnValue({ ...base, loading: true });
    const { rerender } = renderGuard();
    expect(screen.queryByText("Panel del agente")).not.toBeInTheDocument();

    authMock.mockReturnValue({
      ...base, loading: false, user: { id: "u1" }, role: "agente_carga",
    });
    rerender(
      <MemoryRouter initialEntries={["/agente"]}>
        <AgenteProtectedRoute>
          <div>Panel del agente</div>
        </AgenteProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText("Panel del agente")).toBeInTheDocument();
  });

  it("muestra error con reintento si falla la consulta de permisos", () => {
    const refreshProfile = vi.fn();
    authMock.mockReturnValue({
      ...base, loading: false, user: { id: "u1" }, role: null,
      profileError: true, refreshProfile,
    });
    renderGuard();

    expect(screen.getByText("No pudimos verificar tus permisos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refreshProfile).toHaveBeenCalledTimes(1);
  });
});
