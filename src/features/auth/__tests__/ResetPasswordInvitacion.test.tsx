/**
 * Enlace de invitación al portal: `/reset-password?origen=invitacion` debe
 * pedir *crear* la contraseña (no "restablecer") y, al guardarla, anunciar el
 * envío al portal en vez del login.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResetPassword from "@/features/auth/routes/ResetPassword";

const updateUserPasswordMock = vi.fn();

vi.mock("@/features/auth/services", () => ({
  subscribeToAuthChanges: () => ({ unsubscribe: vi.fn() }),
  getCurrentSession: async () => ({ user: { id: "u1" } }),
  updateUserPassword: (p: string) => {
    updateUserPasswordMock(p);
    return Promise.resolve();
  },
  resolveLandingRoute: (role: string | null) => (role === "cliente" ? "/portal" : "/inicio"),
}));

const roleMock: { current: string | null } = { current: "cliente" };
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ role: roleMock.current, user: { id: "u1" }, loading: false }),
}));

function renderReset(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/portal" element={<div>PORTAL CLIENTE</div>} />
        <Route path="/login" element={<div>PANTALLA LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResetPassword · origen=invitacion", () => {
  beforeEach(() => {
    updateUserPasswordMock.mockClear();
    roleMock.current = "cliente";
  });

  it("muestra el copy de creación de contraseña", async () => {
    renderReset("?origen=invitacion");
    expect(await screen.findByText(/Crea tu contraseña/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/Define la contraseña con la que entrarás a tu portal/i),
    ).toBeInTheDocument();
  });

  it("sin el parámetro conserva el copy de restablecimiento", async () => {
    renderReset("");
    expect(await screen.findByText(/Restablecer contraseña/i)).toBeInTheDocument();
    expect(await screen.findByText(/Ingresa tu nueva contraseña/i)).toBeInTheDocument();
  });

  it("tras guardar la contraseña anuncia el envío al portal", async () => {
    renderReset("?origen=invitacion");
    const pwd = await screen.findByLabelText(/^Nueva contraseña$/i);
    fireEvent.change(pwd, { target: { value: "Contrasena#2026" } });
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i), {
      target: { value: "Contrasena#2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Actualizar contraseña/i }));

    await waitFor(() =>
      expect(updateUserPasswordMock).toHaveBeenCalledWith("Contrasena#2026"),
    );
    expect(await screen.findByText(/Te llevaremos a tu portal/i)).toBeInTheDocument();
  });
});
