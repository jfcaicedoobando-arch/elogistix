/**
 * R-07 — El título del toast también se sanea: cuando una mutación pasa
 * `title: err.message` y el backend respondió con HTML (proxy 5xx), el usuario
 * no debe ver etiquetas crudas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => {
  const error = vi.fn();
  const base = vi.fn() as unknown as Record<string, unknown>;
  base.error = error;
  base.success = vi.fn();
  base.warning = vi.fn();
  return { toast: base };
});

vi.mock("@/lib/observability/reportCaughtError", () => ({
  reportCaughtError: vi.fn(),
}));

import { toast as sonnerToast } from "sonner";
import { notifyError } from "../appFeedback";

const m = sonnerToast as unknown as { error: ReturnType<typeof vi.fn> };

beforeEach(() => m.error.mockClear());

describe("appFeedback · saneado del título (R-07)", () => {
  it("reemplaza un título con HTML completo por un mensaje legible", () => {
    notifyError(undefined, {
      title: "<!DOCTYPE html><html><body><h1>530</h1></body></html>",
      method: "TEST",
    });
    const titulo = m.error.mock.calls[0][0] as string;
    expect(titulo).not.toContain("<");
    expect(titulo.length).toBeGreaterThan(0);
  });

  it("conserva intacto un título normal", () => {
    notifyError(undefined, { title: "No se pudo completar la acción", method: "TEST" });
    expect(m.error.mock.calls[0][0]).toBe("No se pudo completar la acción");
  });

  it("cae al título por defecto cuando el título viene vacío", () => {
    notifyError(undefined, { title: "   ", phase: "guardado" });
    expect(m.error.mock.calls[0][0]).toBe("Error: guardado");
  });
});
