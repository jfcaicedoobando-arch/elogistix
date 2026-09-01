/**
 * @vitest-environment jsdom
 *
 * Branches cubiertos:
 *  - useTimbrarFactura: onSuccess invalida cache + slice de uuid; onError mapea mensaje.
 *  - useCancelarFactura: toast "sustituido" vs "cancelado"; onError.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const emitirFacturapi = vi.fn();
const cancelarFacturapi = vi.fn();
const toastSuccess = vi.fn();
const notifySuccess = vi.fn((_t: unknown, opts: { title: string; description?: string }) => {
  if (opts.description !== undefined) toastSuccess(opts.title, { description: opts.description });
  else toastSuccess(opts.title);
});
const notifyError = vi.fn();
const notifyInfo = vi.fn();
const notifyWarning = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("@/features/facturacion/services/facturapi", () => {
  class FacturapiError extends Error {
    transient: boolean;
    constructor(message: string, transient = false) {
      super(message);
      this.transient = transient;
    }
  }
  return {
    emitirFacturapi: (...a: unknown[]) => emitirFacturapi(...a),
    cancelarFacturapi: (...a: unknown[]) => cancelarFacturapi(...a),
    FacturapiError,
  };
});
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: (...a: unknown[]) => notifySuccess(...(a as [unknown, { title: string; description?: string }])),
  notifyError: (...a: unknown[]) => notifyError(...a),
  notifyInfo: (...a: unknown[]) => notifyInfo(...a),
  notifyWarning: (...a: unknown[]) => notifyWarning(...a),
}));

import { useTimbrarFactura, useCancelarFactura } from "../useTimbrarFactura";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  emitirFacturapi.mockReset();
  cancelarFacturapi.mockReset();
  toastSuccess.mockReset();
  notifySuccess.mockClear();
  notifyError.mockReset();
  notifyInfo.mockReset();
  notifyWarning.mockReset();
});

describe("useTimbrarFactura", () => {
  it("onSuccess: muestra serie/folio e invalida facturas.all", async () => {
    emitirFacturapi.mockResolvedValue({ uuid: "ABCDEF12-XYZ", serie: "F", folio: 42 });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useTimbrarFactura(), { wrapper: wrapper(qc) });

    result.current.mutate("fac-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(emitirFacturapi).toHaveBeenCalledWith("fac-1");
    expect(toastSuccess).toHaveBeenCalledWith(
      "Factura timbrada correctamente",
      expect.objectContaining({ description: "Serie F · Folio 42" }),
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: facturasKeys.all });
    qc.clear();
  });

  it("onError: pasa el mensaje del error a notifyError", async () => {
    emitirFacturapi.mockRejectedValue(new Error("boom"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useTimbrarFactura(), { wrapper: wrapper(qc) });

    result.current.mutate("fac-2");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError).toHaveBeenCalledTimes(1);
    const errArg = notifyError.mock.calls[0]![1];
    expect(errArg.title).toBe("No se pudo timbrar");
    expect((errArg.error as Error).message).toContain("boom");
    qc.clear();
  });
});

describe("useCancelarFactura", () => {
  it("rama sustituida=true → toast 'CFDI sustituido'", async () => {
    cancelarFacturapi.mockResolvedValue({ sustituida: true });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCancelarFactura(), { wrapper: wrapper(qc) });

    result.current.mutate({
      facturaId: "f-1",
      motivo: "01",
      sustituyeUuid: "uuid-old",
      sustituidaPorFacturaId: "f-2",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(cancelarFacturapi).toHaveBeenCalledWith("f-1", "01", "uuid-old", "f-2");
    expect(toastSuccess).toHaveBeenCalledWith("CFDI sustituido");
    qc.clear();
  });

  it("rama sustituida=false → toast 'CFDI cancelado'", async () => {
    cancelarFacturapi.mockResolvedValue({ sustituida: false });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCancelarFactura(), { wrapper: wrapper(qc) });

    result.current.mutate({ facturaId: "f-3", motivo: "02" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toastSuccess).toHaveBeenCalledWith("CFDI cancelado");
    qc.clear();
  });

  // v13.821.6 — Timeout de `invoices.cancel` con `verifying` ya persistido: la
  // edge responde 202 { pending, uncertain } y la UI debe informar (no error) y
  // NO ofrecer reintentar la cancelación.
  it("rama uncertain=true → aviso informativo, invalida cache y sin reintento", async () => {
    cancelarFacturapi.mockResolvedValue({
      sustituida: false,
      pending: true,
      uncertain: true,
      cancellation_status: "verifying",
      message: "La solicitud fue enviada, pero FacturApi tardó en confirmar.",
    });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCancelarFactura(), { wrapper: wrapper(qc) });

    result.current.mutate({ facturaId: "f-9", motivo: "02" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(notifyInfo).toHaveBeenCalledTimes(1);
    const opts = notifyInfo.mock.calls[0]![1] as { title: string; description: string };
    expect(opts.title).toContain("verificando");
    expect(opts.description).toContain("Verificar estatus");
    expect(notifyError).not.toHaveBeenCalled();
    expect(notifyWarning).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: facturasKeys.all });
    // No reintenta la cancelación por su cuenta.
    expect(cancelarFacturapi).toHaveBeenCalledTimes(1);
    qc.clear();
  });

  it("onError: propaga mensaje a notifyError", async () => {
    cancelarFacturapi.mockRejectedValue(new Error("no se pudo"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCancelarFactura(), { wrapper: wrapper(qc) });

    result.current.mutate({ facturaId: "f-4", motivo: "02" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifyError.mock.calls[0]![1].description).toContain("no se pudo");
    qc.clear();
  });
});
