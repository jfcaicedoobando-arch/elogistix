/**
 * Enlace de invitación al portal: `/reset-password?origen=invitacion` debe
 * pedir *crear* la contraseña (no "restablecer") y, al guardarla, llevar al
 * portal del rol en vez del login.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResetPassword from "@/features/auth/routes/ResetPassword";

const updateUserPassword = vi.fn(async () => {});

vi.mock("@/features/auth/services", () => ({
  subscribeToAuthChanges: () => ({ unsubscribe: vi.fn() }),
  getCurrentSession: async () => ({ user: { id: "u1" } }),
  updateUserPassword: (p: string) => updateUserPassword(p),
  resolveLandingRoute: (role: string | null) => (role === "cliente" ? "/portal" : "/inicio"),
}));

const roleMock = { current: "cliente" as string | null };
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
    vi.useRealTimers();
    updateUserPassword.mockClear();
    roleMock.current = "cliente";
  });

  it("muestra el copy de creación de contraseña", async () => {
    renderReset("?origen=invitacion");
    expect(await screen.findByText(/Crea tu contraseña/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Define la contraseña con la que entrarás a tu portal/i),
    ).toBeInTheDocument();
  });

  it("sin el parámetro conserva el copy de restablecimiento", async () => {
    renderReset("");
    expect(await screen.findByText(/Restablecer contraseña/i)).toBeInTheDocument();
    expect(screen.getByText(/Ingresa tu nueva contraseña/i)).toBeInTheDocument();
  });

  it("tras guardar la contraseña anuncia el envío al portal", async () => {
    renderReset("?origen=invitacion");
    await screen.findByLabelText(/Nueva contraseña/i);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Nueva contraseña/i), "Contrasena#2026");
    await user.type(screen.getByLabelText(/Confirmar contraseña/i), "Contrasena#2026");
    await user.click(screen.getByRole("button", { name: /Actualizar contraseña/i }));

    await waitFor(() => expect(updateUserPassword).toHaveBeenCalledWith("Contrasena#2026"));
    expect(await screen.findByText(/Te llevaremos a tu portal/i)).toBeInTheDocument();
  });
});
