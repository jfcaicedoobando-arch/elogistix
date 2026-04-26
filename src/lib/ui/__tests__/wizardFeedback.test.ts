import { describe, it, expect, vi } from "vitest";
import { notifyError, notifyWarning, notifySuccess } from "../wizardFeedback";

describe("wizardFeedback", () => {
  it("notifyError con step usa título 'Revisa el Paso N: <nombre>'", () => {
    const toast = vi.fn();
    notifyError(toast, { step: 2, errors: { puertoOrigen: "Puerto de origen: campo obligatorio." } });
    expect(toast).toHaveBeenCalledWith({
      title: "Revisa el Paso 2: Ruta",
      description: "Puerto de origen: campo obligatorio.",
      variant: "destructive",
    });
  });

  it("notifyError con phase usa título 'Error: <fase>'", () => {
    const toast = vi.fn();
    notifyError(toast, { phase: "subida de documentos", message: "boom" });
    expect(toast).toHaveBeenCalledWith({
      title: "Error: subida de documentos",
      description: "boom",
      variant: "destructive",
    });
  });

  it("notifyWarning emite variant warning", () => {
    const toast = vi.fn();
    notifyWarning(toast, { title: "Aviso", description: "ok" });
    expect(toast).toHaveBeenCalledWith({ title: "Aviso", description: "ok", variant: "warning" });
  });

  it("notifySuccess emite variant success", () => {
    const toast = vi.fn();
    notifySuccess(toast, { title: "Listo", description: "ok" });
    expect(toast).toHaveBeenCalledWith({ title: "Listo", description: "ok", variant: "success" });
  });
});
