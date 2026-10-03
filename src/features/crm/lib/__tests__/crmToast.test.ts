import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => {
  const fn = vi.fn() as unknown as ((msg: string, opts?: unknown) => void) & {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  fn.success = vi.fn();
  fn.error = vi.fn();
  fn.info = vi.fn();
  return { toast: fn };
});

import { toast } from "sonner";
import { crmToast } from "../crmToast";
import { resetToastDedupeState } from "@/lib/ui/appFeedback.dedupe";

const toastFn = toast as unknown as ReturnType<typeof vi.fn> & {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  resetToastDedupeState();
  toastFn.mockClear();
  toastFn.success.mockClear();
  toastFn.error.mockClear();
  toastFn.info.mockClear();
});

describe("crmToast", () => {
  it("success usa duración 2s", () => {
    crmToast.success("Creado");
    expect(toastFn.success).toHaveBeenCalledWith(
      "Creado",
      expect.objectContaining({ duration: 2000, id: "ok-Creado" }),
    );
  });

  it("error con Error usa message como descripción", () => {
    crmToast.error("Falló", new Error("boom"));
    expect(toastFn.error).toHaveBeenCalledWith("Falló", expect.objectContaining({
      description: "boom",
      duration: 8000,
      action: expect.objectContaining({ label: "Ver detalles" }),
    }));
  });

  it("error con string usa el string como descripción", () => {
    crmToast.error("Falló", "detalle");
    expect(toastFn.error).toHaveBeenCalledWith("Falló", expect.objectContaining({
      description: "detalle",
      duration: 8000,
    }));
  });

  it("error sin err deja description undefined", () => {
    crmToast.error("Falló");
    expect(toastFn.error).toHaveBeenCalledWith("Falló", expect.objectContaining({
      description: undefined,
      duration: 8000,
    }));
  });

  it("info dispara toast informativo 2s", () => {
    crmToast.info("hola");
    expect(toastFn.info).toHaveBeenCalledWith(
      "hola",
      expect.objectContaining({ duration: 2000, id: "info-hola" }),
    );
  });

  it("undo invoca el callback al hacer click", () => {
    const cb = vi.fn();
    crmToast.undo("Eliminado", cb);
    const [, opts] = toastFn.info.mock.calls.at(-1) as [string, { duration: number; action: { label: string; onClick: () => void } }];
    expect(opts.duration).toBe(5000);
    expect(opts.action.label).toBe("Deshacer");
    opts.action.onClick();
    expect(cb).toHaveBeenCalled();
  });

  it("undo con el mismo título reemplaza la acción y no conserva la anterior", () => {
    const anterior = vi.fn();
    const actual = vi.fn();
    crmToast.undo("Eliminado", anterior);
    crmToast.undo("Eliminado", actual);
    expect(toastFn.info).toHaveBeenCalledTimes(2);
    const opciones = toastFn.info.mock.calls.at(-1)![1];
    opciones.action.onClick();
    expect(actual).toHaveBeenCalledTimes(1);
    expect(anterior).not.toHaveBeenCalled();
  });
});
