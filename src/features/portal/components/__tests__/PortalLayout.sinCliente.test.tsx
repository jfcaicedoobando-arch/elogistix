/**
 * Cubre la rama "sin empresa vinculada" del layout del portal (P-07):
 * cuando la cuenta no tiene registros en `client_users`, el portal debe
 * explicar la situación en vez de mostrar pantallas en ceros.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PortalLayout from "../PortalLayout";

const mocks = vi.hoisted(() => ({
  clientUsers: [] as unknown[],
  isLoading: false,
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "cliente@demo.mx" }, signOut: vi.fn() }),
}));

vi.mock("@/lib/contexts/BreadcrumbContext", () => ({
  useBreadcrumbLabels: () => ({}),
}));

vi.mock("@/features/portal/hooks", () => ({
  usePortalClienteName: () => ({ data: "ACME" }),
  usePortalOrgName: () => ({ data: "Libre Carga" }),
  usePortalClientUsers: () => ({ data: mocks.clientUsers, isLoading: mocks.isLoading }),
}));

vi.mock("@/features/portal/hooks/usePortalBreadcrumbs", () => ({
  usePortalBreadcrumbs: () => [],
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/portal"]}>
      <Routes>
        <Route path="/portal" element={<PortalLayout />}>
          <Route index element={<div>Contenido del portal</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("PortalLayout — cuenta sin cliente vinculado", () => {
  beforeEach(() => {
    mocks.clientUsers = [];
    mocks.isLoading = false;
  });

  it("muestra la pantalla explicativa en lugar del contenido", () => {
    renderLayout();

    expect(screen.getByText(/no está vinculada a una empresa/i)).toBeInTheDocument();
    expect(screen.queryByText("Contenido del portal")).not.toBeInTheDocument();
  });

  it("renderiza el contenido cuando sí hay empresa vinculada", () => {
    mocks.clientUsers = [{ cliente_id: "cli-1" }];
    renderLayout();

    expect(screen.getByText("Contenido del portal")).toBeInTheDocument();
    expect(screen.queryByText(/no está vinculada a una empresa/i)).not.toBeInTheDocument();
  });

  it("no muestra la pantalla mientras el vínculo aún carga", () => {
    mocks.isLoading = true;
    renderLayout();

    expect(screen.queryByText(/no está vinculada a una empresa/i)).not.toBeInTheDocument();
  });
});
