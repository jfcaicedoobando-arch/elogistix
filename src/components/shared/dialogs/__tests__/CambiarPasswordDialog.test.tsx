/**
 * Tests del diálogo de cambio de contraseña.
 * Cubre: validación de longitud, mismatch, éxito, y traducción de errores
 * Supabase Auth (por `code` y por substring del mensaje).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const updateOwnPasswordMock = vi.fn();
const sonnerErrorMock = vi.fn();
const sonnerSuccessMock = vi.fn();

vi.mock("@/lib/auth/changePassword", () => ({
  updateOwnPassword: (p: string) => updateOwnPasswordMock(p),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(
    (...args: unknown[]) => sonnerSuccessMock(...args),
    {
      error: (...args: unknown[]) => sonnerErrorMock(...args),
      warning: (...args: unknown[]) => sonnerErrorMock(...args),
      success: (...args: unknown[]) => sonnerSuccessMock(...args),
    },
  ),
}));

vi.mock("@/lib/observability/reportCaughtError", () => ({
  reportCaughtError: vi.fn(),
}));
vi.mock("@/lib/diagnostics/errorDetailsStore", () => ({
  openErrorReport: vi.fn(),
}));

import { CambiarPasswordDialog } from "../CambiarPasswordDialog";

function renderDialog(onOpenChange = vi.fn()) {
  return {
    onOpenChange,
    ...render(<CambiarPasswordDialog open onOpenChange={onOpenChange} />),
  };
}

const typeIn = (id: string, value: string) =>
  fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });

describe("CambiarPasswordDialog", () => {
  beforeEach(() => {
    updateOwnPasswordMock.mockReset();
    sonnerErrorMock.mockReset();
    sonnerSuccessMock.mockReset();
  });

  it("rechaza contraseña con menos de 8 caracteres", async () => {
    renderDialog();
    typeIn("cambiar-pass-nueva", "abc");
    typeIn("cambiar-pass-confirma", "abc");
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(sonnerErrorMock).toHaveBeenCalled());
    expect(updateOwnPasswordMock).not.toHaveBeenCalled();
  });

  it("rechaza cuando las contraseñas no coinciden", async () => {
    renderDialog();
    typeIn("cambiar-pass-nueva", "password123");
    typeIn("cambiar-pass-confirma", "password999");
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(sonnerErrorMock).toHaveBeenCalled());
    expect(updateOwnPasswordMock).not.toHaveBeenCalled();
  });

  it("guarda contraseña válida y cierra el diálogo", async () => {
    updateOwnPasswordMock.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);
    typeIn("cambiar-pass-nueva", "password123");
    typeIn("cambiar-pass-confirma", "password123");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    });
    await waitFor(() => expect(updateOwnPasswordMock).toHaveBeenCalledWith("password123"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it.each([
    [{ code: "weak_password", message: "weak" }, /fácil de adivinar|filtraciones/i],
    [{ code: "same_password", message: "same" }, /distinta a la actual/i],
    [{ code: "over_request_rate_limit", message: "rl" }, /demasiados intentos/i],
    [{ code: "session_expired", message: "x" }, /sesión expiró/i],
    [{ message: "Password is known to be weak" }, /fácil de adivinar/i],
    [{ message: "New password should be different from the old password" }, /distinta a la actual/i],
    [{ message: "Password must be at least 8 characters" }, /muy corta/i],
    [{ message: "rate limit exceeded" }, /demasiados intentos/i],
    [{ message: "session expired" }, /sesión expiró/i],
    [{ message: "Some unmapped error" }, /some unmapped error/i],
  ])("traduce error %#", async (err, expected) => {
    updateOwnPasswordMock.mockRejectedValue(err);
    renderDialog();
    typeIn("cambiar-pass-nueva", "password123");
    typeIn("cambiar-pass-confirma", "password123");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    });
    await waitFor(() => expect(sonnerErrorMock).toHaveBeenCalled());
    const calls = sonnerErrorMock.mock.calls;
    const found = calls.some((c) =>
      JSON.stringify(c).match(expected),
    );
    expect(found).toBe(true);
  });
});
