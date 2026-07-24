import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

describe("SignupForm — v13.312.22 complejidad reducida", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra el primer error de validación en orden de campo (name antes que email)", async () => {
    render(<SignupForm />);
    type(screen.getByLabelText(/email de trabajo/i), "no-es-email");
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/ingresa tu nombre/i);
    });
  });

  it("muestra pantalla de éxito tras submit válido", async () => {
    (signUpWithEmail as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    render(<SignupForm />);
    type(screen.getByLabelText(/nombre completo/i), "Juan Pérez");
    type(screen.getByLabelText(/nombre de empresa/i), "Mi Agencia SA");
    type(screen.getByLabelText(/email de trabajo/i), "juan@agencia.com");
    type(screen.getByLabelText(/^contraseña$/i), "secret123");
    type(screen.getByLabelText(/confirmar contraseña/i), "secret123");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));
    await waitFor(() => {
      expect(screen.getByText(/te enviamos un correo/i)).toBeInTheDocument();
    });
    expect(signUpWithEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "juan@agencia.com", fullName: "Juan Pérez", companyName: "Mi Agencia SA" }),
    );
  });

  it("bloquea submit si contraseñas no coinciden", async () => {
    render(<SignupForm />);
    type(screen.getByLabelText(/nombre completo/i), "Juan");
    type(screen.getByLabelText(/nombre de empresa/i), "Empresa SA");
    type(screen.getByLabelText(/email de trabajo/i), "j@a.com");
    type(screen.getByLabelText(/^contraseña$/i), "secret123");
    type(screen.getByLabelText(/confirmar contraseña/i), "otro12345");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/no coinciden/i);
    });
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });
});
