import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => {
  const error = vi.fn();
  const success = vi.fn();
  const warning = vi.fn();
  const base = vi.fn();
  // @ts-expect-error fn aug
  base.error = error;
  // @ts-expect-error fn aug
  base.success = success;
  // @ts-expect-error fn aug
  base.warning = warning;
  return { toast: base };
});

import { toast as sonnerToast } from "sonner";
import { notifyError, notifyWarning, notifySuccess } from "../appFeedback";

beforeEach(() => {
  // @ts-expect-error fn aug
  sonnerToast.error.mockClear();
  // @ts-expect-error fn aug
  sonnerToast.success.mockClear();
  // @ts-expect-error fn aug
  sonnerToast.warning.mockClear();
});

describe("appFeedback (sonner)", () => {
  it("notifyError con step usa título 'Revisa el Paso N: <nombre>'", () => {
    notifyError(undefined, { step: 2, errors: { puertoOrigen: "Puerto de origen: campo obligatorio." } });
    // @ts-expect-error fn aug
    expect(sonnerToast.error).toHaveBeenCalledWith(
      "Revisa el Paso 2: Ruta",
      expect.objectContaining({ description: "Puerto de origen: campo obligatorio." }),
    );
  });

  it("notifyError con phase usa título 'Error: <fase>'", () => {
    notifyError(undefined, { phase: "subida de documentos", message: "boom" });
    // @ts-expect-error fn aug
    expect(sonnerToast.error).toHaveBeenCalledWith(
      "Error: subida de documentos",
      expect.objectContaining({ description: "boom" }),
    );
  });

  it("notifyWarning emite sonner.warning", () => {
    notifyWarning(undefined, { title: "Aviso", description: "ok" });
    // @ts-expect-error fn aug
    expect(sonnerToast.warning).toHaveBeenCalledWith("Aviso", { description: "ok" });
  });

  it("notifySuccess emite sonner.success", () => {
    notifySuccess(undefined, { title: "Listo", description: "ok" });
    // @ts-expect-error fn aug
    expect(sonnerToast.success).toHaveBeenCalledWith("Listo", { description: "ok" });
  });
});
