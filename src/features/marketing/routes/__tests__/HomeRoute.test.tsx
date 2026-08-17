/**
 * VT-03 — La ruta pública "/" no debe mandar a `/sin-acceso` cuando el perfil
 * falló por red (lockout total): en ese caso se muestra la landing pública.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import HomeRoute from "@/features/marketing/routes/HomeRoute";

const authState = {
  user: null as { id: string } | null,
  effectiveRole: null as string | null,
  loading: false,
  profileError: false,
};

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/features/marketing/routes/Landing", () => ({
  default: () => <div>Landing pública</div>,
}));

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/inicio" element={<div>Dashboard interno</div>} />
        <Route path="/sin-acceso" element={<div>Sin acceso</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HomeRoute", () => {
  beforeEach(() => {
    authState.user = null;
    authState.effectiveRole = null;
    authState.loading = false;
    authState.profileError = false;
  });

  it("muestra la landing a visitantes sin sesión", async () => {
    renderHome();
    expect(await screen.findByText("Landing pública")).toBeInTheDocument();
  });

  it("redirige al dashboard cuando hay rol resuelto", () => {
    authState.user = { id: "u-1" };
    authState.effectiveRole = "admin";
    renderHome();
    expect(screen.getByText("Dashboard interno")).toBeInTheDocument();
  });

  it("redirige a /sin-acceso cuando el perfil resolvió sin rol", () => {
    authState.user = { id: "u-1" };
    renderHome();
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("muestra la landing (no /sin-acceso) cuando el perfil falló por red", async () => {
    authState.user = { id: "u-1" };
    authState.profileError = true;
    renderHome();
    expect(await screen.findByText("Landing pública")).toBeInTheDocument();
    expect(screen.queryByText("Sin acceso")).not.toBeInTheDocument();
  });
});
