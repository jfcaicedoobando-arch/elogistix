/**
 * Regresión focalizada del controlador de cancelación de REP.
 * Cubre: aceptación total, aceptación con fallo de sincronización local,
        verificación pendiente, resultado incierto y error de cancelación.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCancelarRepController } from "../useCancelarRepController";

const cancelarMutateAsync = vi.fn();
const eliminarMutateAsync = vi.fn();
const registrarActividadMutate = vi.fn();

vi.mock("@/features/facturacion/hooks/useTimbrarRep", () => ({
  useCancelarRep: vi.fn(() => ({
    mutateAsync: cancelarMutateAsync,
    isPending: false,
  })),
}));

vi.mock("@/features/facturacion/hooks", () => ({
  useEliminarPagoFactura: vi.fn(() => ({
    mutateAsync: eliminarMutateAsync,
    isPending: false,
  })),
}));

vi.mock("@/hooks/shared", () => ({
  useRegistrarActividad: vi.fn(() => ({
    mutate: registrarActividadMutate,
  })),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  notifyWarning: vi.fn(),
}));

const pagoBase = {
  id: "pago-1",
  fecha_pago: "2026-01-15",
  monto: 1000,
  moneda: "MXN",
  serie_rep: "P",
  folio_rep: 37,
  uuid_rep: "21658076-214A-49C5-A8BC-F47368BA54A5",
};

function wrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  cancelarMutateAsync.mockReset();
  eliminarMutateAsync.mockReset();
  registrarActividadMutate.mockReset();
});

describe("useCancelarRepController", () => {
  it("aceptación + eliminación local ok → resultado accepted, bitácora e invalidación", async () => {
    cancelarMutateAsync.mockResolvedValue({
      ok: true,
      pending: false,
      uncertain: false,
      cancellation_status: "accepted",
      message: null,
    });
    eliminarMutateAsync.mockResolvedValue(undefined);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries").mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useCancelarRepController(pagoBase, "fac-1", "F-001"),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      const res = await result.current.confirmar();
      expect(res).toBe("accepted");
    });

    await waitFor(() => expect(result.current.resultado).toBe("accepted"));
    expect(cancelarMutateAsync).toHaveBeenCalledWith({ pagoId: "pago-1", motivo: "01" });
    expect(eliminarMutateAsync).toHaveBeenCalledWith({ id: "pago-1", facturaId: "fac-1" });
    expect(registrarActividadMutate).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalled();
    qc.clear();
  });

  it("aceptación SAT + fallo local → resultado accepted_sync_failed y no cierra como accepted", async () => {
    cancelarMutateAsync.mockResolvedValue({
      ok: true,
      pending: false,
      uncertain: false,
      cancellation_status: "accepted",
      message: null,
    });
    eliminarMutateAsync.mockRejectedValue(new Error("No se pudo eliminar pago"));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries").mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useCancelarRepController(pagoBase, "fac-1", "F-001"),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      const res = await result.current.confirmar();
      expect(res).toBe("accepted_sync_failed");
    });

    await waitFor(() => expect(result.current.resultado).toBe("accepted_sync_failed"));
    expect(eliminarMutateAsync).toHaveBeenCalledWith({ id: "pago-1", facturaId: "fac-1" });
    expect(registrarActividadMutate).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
    qc.clear();
  });

  it("respuesta verifying → pending, conserva pago e invalida cache", async () => {
    cancelarMutateAsync.mockResolvedValue({
      ok: true,
      pending: true,
      uncertain: false,
      cancellation_status: "verifying",
      message: "El SAT está verificando.",
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries").mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useCancelarRepController(pagoBase, "fac-1", "F-001"),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      const res = await result.current.confirmar();
      expect(res).toBe("pending");
    });

    await waitFor(() => expect(result.current.resultado).toBe("pending"));
    expect(eliminarMutateAsync).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    qc.clear();
  });

  it("respuesta uncertain → uncertain, conserva pago e invalida cache", async () => {
    cancelarMutateAsync.mockResolvedValue({
      ok: true,
      pending: true,
      uncertain: true,
      cancellation_status: "verifying",
      message: "FacturApi tardó en responder.",
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries").mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useCancelarRepController(pagoBase, "fac-1", "F-001"),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      const res = await result.current.confirmar();
      expect(res).toBe("uncertain");
    });

    await waitFor(() => expect(result.current.resultado).toBe("uncertain"));
    expect(eliminarMutateAsync).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    qc.clear();
  });

  it("error de cancelación SAT → error, no intenta eliminar", async () => {
    cancelarMutateAsync.mockRejectedValue(new Error("No autorizado"));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useCancelarRepController(pagoBase, "fac-1", "F-001"),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      const res = await result.current.confirmar();
      expect(res).toBe("error");
    });

    await waitFor(() => expect(result.current.resultado).toBe("error"));
    expect(eliminarMutateAsync).not.toHaveBeenCalled();
    qc.clear();
  });

  it("sin pago → error inmediato", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useCancelarRepController(null, "fac-1", "F-001"),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      const res = await result.current.confirmar();
      expect(res).toBe("error");
    });

    expect(cancelarMutateAsync).not.toHaveBeenCalled();
    qc.clear();
  });
});
