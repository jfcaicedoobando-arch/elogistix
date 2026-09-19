/**
 * Guards de autenticación/rol/organización bajo React Router 7 (modo declarativo).
 *
 * Verifica que `<Navigate>` conserve la semántica de v6: deep-link en `state.from`
 * al mandar a login, redirección a `/sin-acceso` con motivo y paso libre cuando
 * el rol satisface la matriz.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import type { AppRole } from "@/types/appRole";

const authState = {
  user: null as { id: string } | null,
  role: null as AppRole | null,
  effectiveRole: null as AppRole | null,
  organization: null as { id: string } | null,
  loading: false,
  profileError: null as unknown,
};

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifyWarning: vi.fn(),
}));

import { ProtectedRoute } from "../ProtectedRoute";

function Probe({ etiqueta }: { etiqueta: string }) {
  const location = useLocation();
  const state = location.state as { from?: unknown; motivo?: string } | null;
  return (
    <div>
      <span data-testid="destino">{etiqueta}</span>
      <span data-testid="state">{JSON.stringify(state ?? {})}</span>
    </div>
  );
}

function montar(rutaInicial: string, allowedRoles?: AppRole[]) {
  return render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <Routes>
        <Route
          path="/embarques/:id"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <Probe etiqueta="protegido" />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Probe etiqueta="login" />} />
        <Route path="/sin-acceso" element={<Probe etiqueta="sin-acceso" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute con React Router 7", () => {
  beforeEach(() => {
    authState.user = null;
    authState.role = null;
    authState.effectiveRole = null;
    authState.organization = null;
    authState.loading = false;
    authState.profileError = null;
  });

  it("manda a login preservando el deep-link solicitado", () => {
    montar("/embarques/abc?tab=documentos");
    expect(screen.getByTestId("destino").textContent).toBe("login");
    expect(screen.getByTestId("state").textContent).toContain("/embarques/abc");
    expect(screen.getByTestId("state").textContent).toContain("tab=documentos");
  });

  it("manda a /sin-acceso con motivo cuando el rol no cubre el módulo", () => {
    authState.user = { id: "u1" };
    authState.role = "ventas" as AppRole;
    authState.effectiveRole = "ventas" as AppRole;
    authState.organization = { id: "o1" };
    montar("/embarques/abc", ["admin" as AppRole]);
    expect(screen.getByTestId("destino").textContent).toBe("sin-acceso");
    expect(screen.getByTestId("state").textContent).toContain("permiso-modulo");
  });

  it("es fail-closed cuando no hay rol resuelto", () => {
    authState.user = { id: "u1" };
    authState.organization = { id: "o1" };
    montar("/embarques/abc", ["admin" as AppRole]);
    expect(screen.getByTestId("destino").textContent).toBe("sin-acceso");
    expect(screen.getByTestId("state").textContent).toContain("sin-rol-org");
  });

  it("permite el paso cuando el rol satisface la matriz", () => {
    authState.user = { id: "u1" };
    authState.role = "admin" as AppRole;
    authState.effectiveRole = "admin" as AppRole;
    authState.organization = { id: "o1" };
    montar("/embarques/abc", ["admin" as AppRole]);
    expect(screen.getByTestId("destino").textContent).toBe("protegido");
  });
});
