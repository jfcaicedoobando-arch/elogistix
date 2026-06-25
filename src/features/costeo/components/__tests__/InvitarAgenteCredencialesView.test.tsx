import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const sonnerErrorMock = vi.fn();
const sonnerSuccessMock = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign((...a: unknown[]) => sonnerSuccessMock(...a), {
    success: (...a: unknown[]) => sonnerSuccessMock(...a),
    error: (...a: unknown[]) => sonnerErrorMock(...a),
    warning: (...a: unknown[]) => sonnerErrorMock(...a),
  }),
}));
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));
vi.mock("@/lib/diagnostics/errorDetailsStore", () => ({ openErrorReport: vi.fn() }));

import { InvitarAgenteCredencialesView } from "../InvitarAgenteCredencialesView";

describe("InvitarAgenteCredencialesView", () => {
  const writeText = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    writeText.mockClear();
    sonnerErrorMock.mockReset();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it("renderiza email y contraseña como readonly", () => {
    render(<InvitarAgenteCredencialesView email="a@b.com" password="P4ssw0rd!" onClose={() => {}} />);
    expect((screen.getByDisplayValue("a@b.com") as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByDisplayValue("P4ssw0rd!") as HTMLInputElement).readOnly).toBe(true);
  });

  it("copia ambos cuando se hace clic en 'Copiar ambos'", async () => {
    render(<InvitarAgenteCredencialesView email="a@b.com" password="pw" onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /copiar ambos/i }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Email: a@b.com\nContraseña: pw"),
    );
  });

  it("invoca onClose al hacer clic en 'Cerrar'", () => {
    const onClose = vi.fn();
    render(<InvitarAgenteCredencialesView email="x" password="y" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /^cerrar$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("notifica error si el clipboard falla", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: () => Promise.reject(new Error("nope")) },
    });
    render(<InvitarAgenteCredencialesView email="a@b.com" password="pw" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/copiar email/i));
    await waitFor(() => expect(sonnerErrorMock).toHaveBeenCalled());
  });
});
