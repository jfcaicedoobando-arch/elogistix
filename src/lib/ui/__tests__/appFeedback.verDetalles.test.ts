/**
 * VF-02 — `notifyError` sólo adjunta "Ver detalles" cuando hay detalle técnico
 * real; en validaciones de captura el botón abría un reporte vacío.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast as sonnerToast } from "sonner";
import { notifyError } from "@/lib/ui/appFeedback";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const errorSpy = sonnerToast.error as unknown as ReturnType<typeof vi.fn>;

/** Lee la opción `action` del último toast emitido. */
function ultimaAccion() {
  const call = errorSpy.mock.calls.at(-1);
  return (call?.[1] as { action?: { label: string } } | undefined)?.action;
}

describe("notifyError · acción Ver detalles", () => {
  beforeEach(() => {
    errorSpy.mockClear();
  });

  it("no adjunta la acción cuando es una validación sin detalle", () => {
    notifyError(undefined, { title: "Selecciona un cliente" });
    expect(errorSpy).toHaveBeenCalled();
    expect(ultimaAccion()).toBeUndefined();
  });

  it("adjunta la acción cuando hay un error real", () => {
    notifyError(undefined, { title: "Falló el guardado", error: new Error("boom") });
    expect(ultimaAccion()?.label).toBe("Ver detalles");
  });

  it("adjunta la acción cuando hay código de error", () => {
    notifyError(undefined, { title: "Sin permisos", errorCode: "LC_SOD_VIOLATION" });
    expect(ultimaAccion()?.label).toBe("Ver detalles");
  });
});
