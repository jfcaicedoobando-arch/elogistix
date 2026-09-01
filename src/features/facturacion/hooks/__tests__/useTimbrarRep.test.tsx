/**
 * @vitest-environment jsdom
 *
 * Branches: rama facturaId definido vs undefined en invalidateQueries
 * (timbrar/cancelar REP) y branches de error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const emitirRep = vi.fn();
const cancelarRep = vi.fn();
const toastSuccess = vi.fn();
const notifyError = vi.fn();
const notifyInfo = vi.fn();

class RepYaTimbradoErrorMock extends Error {
  readonly code = "ya_timbrado_rep";
}

vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a) },
}));
vi.mock("@/features/facturacion/services/repFacturapi", () => ({
  emitirRep: (...a: unknown[]) => emitirRep(...a),
  cancelarRep: (...a: unknown[]) => cancelarRep(...a),
  esRepYaTimbrado: (e: unknown) => e instanceof RepYaTimbradoErrorMock,
}));
vi.mock("@/features/facturacion/services/repAutoEmail", () => ({
  autoEnviarRepPorCorreo: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/profit/hooks/invalidateProfitDependencies", () => ({
  invalidateProfitDependencies: vi.fn(),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
  notifySuccess: (_t: unknown, opts: { title: string }) => toastSuccess(opts.title),
  notifyInfo: (...a: unknown[]) => notifyInfo(...a),
}));

import { useTimbrarRep, useCancelarRep } from "../useTimbrarRep";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  emitirRep.mockReset();
  cancelarRep.mockReset();
  toastSuccess.mockReset();
  notifyError.mockReset();
  notifyInfo.mockReset();
});

describe("useTimbrarRep", () => {
  it("con facturaId: invalida pagos_factura del id + rep_pendientes", async () => {
    emitirRep.mockResolvedValue({ uuid: "UUID1234-rest" });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useTimbrarRep("fac-1"), { wrapper: wrapper(qc) });

    result.current.mutate("pago-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(emitirRep).toHaveBeenCalledWith("pago-1");
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("UUID1234"));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["pagos_factura", "fac-1"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["rep_pendientes"] });
    qc.clear();
  });

  it("sin facturaId: invalida ['pagos_factura'] (rama else)", async () => {
    emitirRep.mockResolvedValue({ uuid: "AAAAAAAA-x" });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useTimbrarRep(), { wrapper: wrapper(qc) });

    result.current.mutate("pago-2");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith({ queryKey: ["pagos_factura"] });
    qc.clear();
  });

  it("onError: notifyError con mensaje", async () => {
    emitirRep.mockRejectedValue(new Error("rep fail"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useTimbrarRep("fac-x"), { wrapper: wrapper(qc) });

    result.current.mutate("pago-3");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifyError.mock.calls[0]![1].description).toContain("rep fail");
    qc.clear();
  });



  it("409 ya timbrado: avisa en tono informativo y refresca en lugar de alertar", async () => {
    emitirRep.mockRejectedValue(new RepYaTimbradoErrorMock("Este pago ya tiene REP timbrado."));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useTimbrarRep("fac-1"), { wrapper: wrapper(qc) });

    result.current.mutate("pago-4");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError).not.toHaveBeenCalled();
    expect(notifyInfo).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: "Este pago ya tenía su REP timbrado",
    }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["pagos_factura", "fac-1"] });
    qc.clear();
  });
});

describe("useCancelarRep", () => {
  it("con facturaId: invalida pagos_factura del id", async () => {
    cancelarRep.mockResolvedValue({ ok: true, pending: false, cancellation_status: "accepted" });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCancelarRep("fac-1"), { wrapper: wrapper(qc) });

    result.current.mutate({ pagoId: "p-1", motivo: "02" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(cancelarRep).toHaveBeenCalledWith("p-1", "02", undefined);
    expect(toastSuccess).toHaveBeenCalledWith("REP cancelado");
    expect(spy).toHaveBeenCalledWith({ queryKey: ["pagos_factura", "fac-1"] });
    qc.clear();
  });

  it("avisa cuando la cancelación sólo quedó en verificación", async () => {
    cancelarRep.mockResolvedValue({
      ok: true,
      pending: true,
      cancellation_status: "verifying",
      message: "El SAT está verificando.",
    });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCancelarRep("fac-1"), { wrapper: wrapper(qc) });

    result.current.mutate({ pagoId: "p-pending", motivo: "02" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(notifyInfo).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: "Solicitud de cancelación enviada",
      description: "El SAT está verificando.",
    }));
    qc.clear();
  });

  it("sin facturaId: invalida ['pagos_factura'] (rama else)", async () => {
    cancelarRep.mockResolvedValue({ ok: true, pending: false, cancellation_status: "accepted" });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCancelarRep(), { wrapper: wrapper(qc) });

    result.current.mutate({ pagoId: "p-2", motivo: "01", sustituyeUuid: "uuid-old" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(cancelarRep).toHaveBeenCalledWith("p-2", "01", "uuid-old");
    expect(spy).toHaveBeenCalledWith({ queryKey: ["pagos_factura"] });
    qc.clear();
  });

  it("onError: notifyError", async () => {
    cancelarRep.mockRejectedValue(new Error("no autorizado"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCancelarRep("fac-z"), { wrapper: wrapper(qc) });

    result.current.mutate({ pagoId: "p-3", motivo: "02" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError.mock.calls[0]![1].description).toContain("no autorizado");
    qc.clear();
  });

  it("uncertain: aviso informativo, invalida cache y no ofrece reintentar", async () => {
    cancelarRep.mockResolvedValue({
      ok: true,
      uncertain: true,
      pending: true,
      cancellation_status: "verifying",
      message: "FacturApi tardó en responder.",
    });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCancelarRep("fac-1"), { wrapper: wrapper(qc) });

    result.current.mutate({ pagoId: "p-uncertain", motivo: "02" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(notifyInfo).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: "Cancelación del REP enviada · verificando",
      description: "FacturApi tardó en responder.",
    }));
    expect(notifyInfo.mock.calls[0]![1].description).not.toMatch(/reintent/i);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["pagos_factura", "fac-1"] });
    qc.clear();
  });
});
