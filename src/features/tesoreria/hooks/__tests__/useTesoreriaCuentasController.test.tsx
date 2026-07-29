import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/features/tesoreria/hooks", () => ({
  useCuentasBancarias: () => ({ data: [], isLoading: false }),
  useCrearCuenta: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEliminarCuenta: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));

import { useTesoreriaCuentasController } from "../useTesoreriaCuentasController";

describe("useTesoreriaCuentasController — Q-15.8 reset al abrir", () => {
  it("resetea el formulario al reabrir el modal tras capturar datos y cancelar", () => {
    const { result } = renderHook(() => useTesoreriaCuentasController());

    act(() => result.current.setField("alias", "Cuenta vieja"));
    expect(result.current.form.alias).toBe("Cuenta vieja");

    act(() => result.current.setOpen(false)); // cancelar sin limpiar
    expect(result.current.form.alias).toBe("Cuenta vieja");

    act(() => result.current.setOpen(true)); // reabrir
    expect(result.current.form.alias).toBe("");
    expect(result.current.open).toBe(true);
  });
});
