import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => {
  const error = vi.fn();
  const success = vi.fn();
  const warning = vi.fn();
  const base = vi.fn() as unknown as Record<string, unknown>;
  base.error = error;
  base.success = success;
  base.warning = warning;
  return { toast: base };
});

import { toast as sonnerToast } from "sonner";
import { notifyError, notifyWarning, notifySuccess, isAuthorizationError } from "../appFeedback";

const reportCaughtErrorMock = vi.fn();
vi.mock("@/lib/observability/reportCaughtError", () => ({
  reportCaughtError: (...args: unknown[]) => reportCaughtErrorMock(...args),
}));

const m = sonnerToast as unknown as {
  error: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  m.error.mockClear();
  m.success.mockClear();
  m.warning.mockClear();
});

describe("appFeedback (sonner)", () => {
  it("notifyError con step usa título 'Revisa el Paso N: <nombre>'", () => {
    notifyError(undefined, { step: 2, errors: { puertoOrigen: "Puerto de origen: campo obligatorio." } });
    expect(m.error).toHaveBeenCalledWith(
      "Revisa el Paso 2: Ruta",
      expect.objectContaining({ description: "Puerto de origen: campo obligatorio." }),
    );
  });

  it("notifyError con phase usa título 'Error: <fase>'", () => {
    notifyError(undefined, { phase: "subida de documentos", message: "boom" });
    expect(m.error).toHaveBeenCalledWith(
      "Error: subida de documentos",
      expect.objectContaining({ description: "boom" }),
    );
  });

  it("notifyWarning emite sonner.warning", () => {
    notifyWarning(undefined, { title: "Aviso", description: "ok" });
    expect(m.warning).toHaveBeenCalledWith("Aviso", { description: "ok" });
  });

  it("notifySuccess emite sonner.success", () => {
    notifySuccess(undefined, { title: "Listo", description: "ok" });
    expect(m.success).toHaveBeenCalledWith("Listo", { description: "ok" });
  });
});
