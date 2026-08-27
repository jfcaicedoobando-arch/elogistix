import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const actualizarMutate = vi.fn().mockResolvedValue({});
const crearMutate = vi.fn().mockResolvedValue({});
let tieneMovimientos = false;

vi.mock("@/features/tesoreria/hooks", () => ({
  useCuentasBancarias: () => ({ data: [], isLoading: false }),
  useCrearCuenta: () => ({ mutateAsync: crearMutate, isPending: false }),
  useActualizarCuenta: () => ({ mutateAsync: actualizarMutate, isPending: false }),
  useEliminarCuenta: () => ({ mutate: vi.fn(), isPending: false }),
  useTieneMovimientosCuenta: () => ({ data: tieneMovimientos }),
}));
const notifyError = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: (...a: unknown[]) => notifyError(...a) }));
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));

import { useTesoreriaCuentasController } from "../useTesoreriaCuentasController";

const CUENTA = {
  id: "c1",
  alias: "BBVA MXN",
  banco: "BBVA",
  moneda: "MXN",
  numero_cuenta: "123",
  clabe: "",
  saldo_inicial: 467788.69,
  fecha_saldo_inicial: "2026-08-06",
};

describe("useTesoreriaCuentasController — edición de cuenta", () => {
  beforeEach(() => {
    actualizarMutate.mockClear();
    crearMutate.mockClear();
    notifyError.mockClear();
    tieneMovimientos = false;
  });

  it("precarga el formulario y envía el patch al guardar", async () => {
    const { result } = renderHook(() => useTesoreriaCuentasController());

    act(() => result.current.solicitarEditar(CUENTA));
    expect(result.current.form.alias).toBe("BBVA MXN");
    expect(result.current.form.saldoInicial).toBe(467788.69);

    act(() => result.current.setField("saldoInicial", 535548.69));
    expect(result.current.avisoRecalculo).toBe(true);

    await act(async () => { await result.current.submit(); });

    expect(crearMutate).not.toHaveBeenCalled();
    expect(actualizarMutate).toHaveBeenCalledWith({
      id: "c1",
      patch: expect.objectContaining({ saldo_inicial: 535548.69, fecha_saldo_inicial: "2026-08-06" }),
      expectedUpdatedAt: null,
    });
  });

  it("bloquea el cambio de moneda cuando la cuenta ya tiene movimientos", async () => {
    tieneMovimientos = true;
    const { result } = renderHook(() => useTesoreriaCuentasController());

    act(() => result.current.solicitarEditar(CUENTA));
    expect(result.current.monedaBloqueada).toBe(true);

    act(() => result.current.setField("moneda", "USD"));
    await act(async () => { await result.current.submit(); });

    expect(actualizarMutate).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalled();
  });
});
