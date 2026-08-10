import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const notifySuccess = vi.fn();
const notifyError = vi.fn();
const notifyWarning = vi.fn();
const emitirRep = vi.fn();
const mutateAsync = vi.fn();
const registrarActividadMutate = vi.fn();

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: (...a: unknown[]) => notifySuccess(...a),
  notifyError: (...a: unknown[]) => notifyError(...a),
  notifyWarning: (...a: unknown[]) => notifyWarning(...a),
}));
vi.mock("@/features/facturacion/services/repFacturapi", () => ({
  emitirRep: (...a: unknown[]) => emitirRep(...a),
}));
vi.mock("@/features/facturacion/hooks", () => ({
  useRegistrarPagoFactura: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
  useRegistrarActividad: () => ({ mutate: registrarActividadMutate }),
}));
vi.mock("@/lib/formatters", () => ({
  formatCurrency: (n: number, m: string) => `${m} ${n}`,
}));

import { useRegistrarPagoSubmit } from "../useRegistrarPagoSubmit";

const baseArgs = {
  facturaId: "fac-1",
  facturaNumero: "F-001",
  fecha: "2026-01-15",
  monto: 1000,
  moneda: "MXN" as const,
  tipoCambio: 1,
  montoAplicado: 1000,
  formaPago: "03",
  referencia: "ref",
  notas: "",
  esPpdTimbrada: false,
};

beforeEach(() => {
  notifySuccess.mockReset();
  notifyError.mockReset();
  notifyWarning.mockReset();
  emitirRep.mockReset();
  mutateAsync.mockReset();
  registrarActividadMutate.mockReset();
});

describe("useRegistrarPagoSubmit", () => {
  it("happy path PUE: registra pago, registra actividad y llama onSuccess sin timbrar REP", async () => {
    mutateAsync.mockResolvedValue({ pagoId: "pago-1", movimientoBancario: "no_aplica" });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRegistrarPagoSubmit(onSuccess));

    await act(async () => {
      await result.current.submit(baseArgs);
    });

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      factura_id: "fac-1",
      monto: 1000,
      moneda: "MXN",
      forma_pago: "03",
    }));
    expect(registrarActividadMutate).toHaveBeenCalledWith(expect.objectContaining({
      accion: "crear",
      modulo: "facturas",
      entidad_id: "fac-1",
      entidad_nombre: expect.stringContaining("MXN 1000"),
    }));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, { title: "Pago registrado" });
    expect(emitirRep).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("PPD timbrada: emite REP exitosamente y muestra dos toasts de éxito", async () => {
    mutateAsync.mockResolvedValue({ pagoId: "pago-2", movimientoBancario: "no_aplica" });
    emitirRep.mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRegistrarPagoSubmit(onSuccess));

    await act(async () => {
      await result.current.submit({ ...baseArgs, esPpdTimbrada: true });
    });

    expect(emitirRep).toHaveBeenCalledWith("pago-2");
    expect(notifySuccess).toHaveBeenCalledTimes(2);
    expect(notifySuccess).toHaveBeenNthCalledWith(2, undefined, expect.objectContaining({ title: "REP timbrado" }));
    expect(onSuccess).toHaveBeenCalled();
    expect(result.current.timbrandoRep).toBe(false);
  });

  it("PPD timbrada: si emitirRep falla, notifica error de REP pero sigue llamando onSuccess", async () => {
    mutateAsync.mockResolvedValue({ pagoId: "pago-3", movimientoBancario: "no_aplica" });
    emitirRep.mockRejectedValue(new Error("SAT down"));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRegistrarPagoSubmit(onSuccess));

    await act(async () => {
      await result.current.submit({ ...baseArgs, esPpdTimbrada: true });
    });

    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: "Pago registrado, pero el REP falló",
      description: expect.stringContaining("SAT down"),
    }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.timbrandoRep).toBe(false);
  });

  it("PPD timbrada sin pagoId: no intenta timbrar REP", async () => {
    mutateAsync.mockResolvedValue({ pagoId: null, movimientoBancario: "no_aplica" });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRegistrarPagoSubmit(onSuccess));

    await act(async () => {
      await result.current.submit({ ...baseArgs, esPpdTimbrada: true });
    });

    expect(emitirRep).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("error al registrar pago: notifica error y NO llama onSuccess ni actividad", async () => {
    mutateAsync.mockRejectedValue(new Error("Saldo inválido"));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRegistrarPagoSubmit(onSuccess));

    await act(async () => {
      await result.current.submit(baseArgs);
    });

    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: "Error al registrar pago",
      description: expect.stringContaining("Saldo inválido"),
    }));
    expect(registrarActividadMutate).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(emitirRep).not.toHaveBeenCalled();
  });

  it("expone timbrandoRep=true mientras emitirRep está en vuelo", async () => {
    mutateAsync.mockResolvedValue({ pagoId: "pago-4", movimientoBancario: "no_aplica" });
    let resolveRep: () => void = () => {};
    emitirRep.mockImplementation(() => new Promise<void>((r) => { resolveRep = r; }));
    const { result } = renderHook(() => useRegistrarPagoSubmit(vi.fn()));

    let submitPromise!: Promise<void>;
    await act(async () => {
      submitPromise = result.current.submit({ ...baseArgs, esPpdTimbrada: true });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.timbrandoRep).toBe(true));
    await act(async () => {
      resolveRep();
      await submitPromise;
    });
    expect(result.current.timbrandoRep).toBe(false);
  });
});
