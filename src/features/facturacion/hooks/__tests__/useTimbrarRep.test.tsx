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

vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a) },
}));
vi.mock("@/features/facturacion/services/repFacturapi", () => ({
  emitirRep: (...a: unknown[]) => emitirRep(...a),
  cancelarRep: (...a: unknown[]) => cancelarRep(...a),
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
  notifyInfo: vi.fn(),
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
});

describe("useCancelarRep", () => {
  it("con facturaId: invalida pagos_factura del id", async () => {
    cancelarRep.mockResolvedValue({ ok: true });
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

  it("sin facturaId: invalida ['pagos_factura'] (rama else)", async () => {
    cancelarRep.mockResolvedValue({ ok: true });
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
});
