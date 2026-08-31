/**
 * P3 (v13.819.1) — Desde `/sin-acceso`, "Cerrar sesión" limpiaba la sesión pero
 * la pantalla se quedaba en `/sin-acceso` hasta navegar a mano a `/login`.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const signOut = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/auth/signOut", () => ({ signOutCurrentSession: () => signOut() }));

import { SinAccesoAcciones } from "../SinAccesoContent";

describe("SinAccesoAcciones · cerrar sesión", () => {
  beforeEach(() => {
    navigate.mockClear();
    signOut.mockClear();
  });

  it("redirige a /login después del signOut", async () => {
    render(
      <MemoryRouter>
        <SinAccesoAcciones
          variant="sin-rol-org"
          effectiveRole={null}
          esAdministrador={false}
          onRetry={vi.fn()}
          retrying={false}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cerrar sesión/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login", { replace: true }));
  });

  it("también redirige en la variante de error de carga", async () => {
    render(
      <MemoryRouter>
        <SinAccesoAcciones
          variant="error-carga"
          effectiveRole="contador"
          esAdministrador={false}
          onRetry={vi.fn()}
          retrying={false}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cerrar sesión/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login", { replace: true }));
  });
});
