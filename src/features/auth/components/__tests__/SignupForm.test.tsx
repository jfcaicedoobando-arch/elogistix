import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupForm } from "../SignupForm";

vi.mock("@/features/auth/services", () => ({
  signUpWithEmail: vi.fn(),
}));
vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: vi.fn(),
}));

import { signUpWithEmail } from "@/features/auth/services";

describe("SignupForm — v13.312.22 complejidad reducida", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra el primer error de validación en orden de campo (name antes que email)", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    // Llenar sólo email para forzar múltiples errores; name queda vacío → debe salir primero
    await user.type(screen.getByLabelText(/email de trabajo/i), "no-es-email");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/ingresa tu nombre/i);
    });
  });

  it("muestra pantalla de éxito tras submit válido", async () => {
    (signUpWithEmail as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByLabelText(/nombre completo/i), "Juan Pérez");
    await user.type(screen.getByLabelText(/nombre de empresa/i), "Mi Agencia SA");
    await user.type(screen.getByLabelText(/email de trabajo/i), "juan@agencia.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "secret123");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "secret123");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));
    await waitFor(() => {
      expect(screen.getByText(/te enviamos un correo/i)).toBeInTheDocument();
    });
    expect(signUpWithEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "juan@agencia.com", fullName: "Juan Pérez", companyName: "Mi Agencia SA" }),
    );
  });

  it("bloquea submit si contraseñas no coinciden", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByLabelText(/nombre completo/i), "Juan");
    await user.type(screen.getByLabelText(/nombre de empresa/i), "Empresa SA");
    await user.type(screen.getByLabelText(/email de trabajo/i), "j@a.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "secret123");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "otro12345");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/no coinciden/i);
    });
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });
});
