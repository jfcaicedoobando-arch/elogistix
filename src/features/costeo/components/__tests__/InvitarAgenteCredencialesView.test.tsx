import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    writeText.mockImplementation(() => Promise.resolve());
    sonnerErrorMock.mockReset();
    // Auditoría 13.137.31: `Object.assign(navigator, { clipboard })` dejaba el
    // clipboard parcheado para archivos posteriores del shard bajo singleFork.
    // Migrado a `vi.stubGlobal("navigator", ...)` + `vi.unstubAllGlobals()` en afterEach.
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    const failingWrite = vi.fn(() => Promise.reject(new Error("nope")));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: failingWrite } });
    render(<InvitarAgenteCredencialesView email="a@b.com" password="pw" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/copiar email/i));
    await waitFor(() => expect(sonnerErrorMock).toHaveBeenCalled());
  });
});
