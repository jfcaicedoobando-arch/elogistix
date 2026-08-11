/**
 * v13.495.0 — El aviso al usuario cuando el movimiento bancario no se creó.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const notifyWarning = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyWarning: (...args: unknown[]) => notifyWarning(...args),
}));

import { avisarMovimientoNoCreado } from "../pagoProveedorMovimientoAviso";

describe("avisarMovimientoNoCreado", () => {
  beforeEach(() => notifyWarning.mockClear());

  it("no avisa cuando el movimiento se creó", () => {
    expect(avisarMovimientoNoCreado({ ok: true })).toBe(true);
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it("avisa con el motivo real cuando falló", () => {
    expect(avisarMovimientoNoCreado({ ok: false, error: "permiso denegado" })).toBe(false);
    expect(notifyWarning).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        description: expect.stringContaining("permiso denegado"),
      }),
    );
  });
});
