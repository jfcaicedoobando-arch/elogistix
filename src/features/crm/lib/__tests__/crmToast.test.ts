import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => {
  const fn = vi.fn() as unknown as ((msg: string, opts?: unknown) => void) & {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  fn.success = vi.fn();
  fn.error = vi.fn();
  return { toast: fn };
});

import { toast } from "sonner";
import { crmToast } from "../crmToast";

const toastFn = toast as unknown as ReturnType<typeof vi.fn> & {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  toastFn.mockClear();
  toastFn.success.mockClear();
  toastFn.error.mockClear();
});

describe("crmToast", () => {
  it("success usa duración 2s", () => {
    crmToast.success("Creado");
    expect(toastFn.success).toHaveBeenCalledWith("Creado", { duration: 2000 });
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

  it("info dispara toast base 2s", () => {
    crmToast.info("hola");
    expect(toastFn).toHaveBeenCalledWith("hola", { duration: 2000 });
  });

  it("undo invoca el callback al hacer click", () => {
    const cb = vi.fn();
    crmToast.undo("Eliminado", cb);
    const [, opts] = toastFn.mock.calls.at(-1) as [string, { duration: number; action: { label: string; onClick: () => void } }];
    expect(opts.duration).toBe(5000);
    expect(opts.action.label).toBe("Deshacer");
    opts.action.onClick();
    expect(cb).toHaveBeenCalled();
  });
});
