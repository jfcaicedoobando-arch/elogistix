/**
 * P3 (v13.819.1) — Desde `/sin-acceso`, "Cerrar sesión" limpiaba la sesión pero
 * la pantalla se quedaba en `/sin-acceso` hasta navegar a mano a `/login`.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";

const navigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => navigate };
});

const signOut = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ signOut }) }));
const toastError = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: (...args: unknown[]) => toastError(...args) }));

import { SinAccesoAcciones } from "../SinAccesoContent";

describe("SinAccesoAcciones · cerrar sesión", () => {
  beforeEach(() => {
    navigate.mockClear();
    signOut.mockReset().mockResolvedValue(undefined);
    toastError.mockClear();
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

  it("no navega ni expone detalles cuando falla el cierre local y permite reintentar", async () => {
  signOut.mockRejectedValueOnce(new Error("secret-token"));
  render(<MemoryRouter><SinAccesoAcciones variant="sin-rol-org" effectiveRole={null} esAdministrador={false} onRetry={vi.fn()} retrying={false} /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Cerrar sesión/i }));
  await waitFor(() => expect(toastError).toHaveBeenCalled());
  expect(navigate).not.toHaveBeenCalled();
  expect(JSON.stringify(toastError.mock.calls)).not.toContain("secret-token");
  fireEvent.click(screen.getByRole("button", { name: /Cerrar sesión/i }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login", { replace: true }));
});

  it("evita cierres simultáneos y espera la confirmación antes de navegar", async () => {
    let complete!: () => void;
    signOut.mockReturnValueOnce(new Promise<void>((resolve) => { complete = resolve; }));
    render(<MemoryRouter><SinAccesoAcciones variant="sin-rol-org" effectiveRole={null} esAdministrador={false} onRetry={vi.fn()} retrying={false} /></MemoryRouter>);
    const button = screen.getByRole("button", { name: /Cerrar sesión/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(signOut).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    expect(navigate).not.toHaveBeenCalled();
    complete();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login", { replace: true }));
  });

});
