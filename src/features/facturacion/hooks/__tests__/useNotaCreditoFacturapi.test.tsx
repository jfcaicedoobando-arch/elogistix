/**
 * @vitest-environment jsdom
 *
 * Branches: timbrar y cancelar nota de crédito (onSuccess/onError).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const timbrarNotaCreditoFacturapi = vi.fn();
const cancelarNotaCreditoFacturapi = vi.fn();
const toastSuccess = vi.fn();
const notifyError = vi.fn();

vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));
vi.mock("@/features/facturacion/services/notasCreditoFacturapi", () => ({
  timbrarNotaCreditoFacturapi: (...a: unknown[]) => timbrarNotaCreditoFacturapi(...a),
  cancelarNotaCreditoFacturapi: (...a: unknown[]) => cancelarNotaCreditoFacturapi(...a),
}));
const notifyInfo = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
  notifySuccess: (_t: unknown, opts: { title: string }) => toastSuccess(opts?.title),
  notifyInfo: (...a: unknown[]) => notifyInfo(...a),
}));

import {
  useTimbrarNotaCredito,
  useCancelarNotaCredito,
} from "../useNotaCreditoFacturapi";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  timbrarNotaCreditoFacturapi.mockReset();
  cancelarNotaCreditoFacturapi.mockReset();
  toastSuccess.mockReset();
  notifyError.mockReset();
  notifyInfo.mockReset();
});

describe("useTimbrarNotaCredito", () => {
  it("onSuccess: muestra UUID truncado e invalida cache de notas de crédito", async () => {
    timbrarNotaCreditoFacturapi.mockResolvedValue({ uuid: "NCAAAAAA-rest" });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useTimbrarNotaCredito("fac-1"), { wrapper: wrapper(qc) });

    result.current.mutate("nc-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(timbrarNotaCreditoFacturapi).toHaveBeenCalledWith("nc-1");
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("NCAAAAAA"));
    expect(spy).toHaveBeenCalledWith({ queryKey: facturasKeys.notasCredito("fac-1") });
    expect(spy).toHaveBeenCalledWith({ queryKey: facturasKeys.notasCreditoRecientes() });
    qc.clear();
  });

  it("timbrar NC onError: notifyError con mensaje", async () => {
    timbrarNotaCreditoFacturapi.mockRejectedValue(new Error("nc fail"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useTimbrarNotaCredito("fac-1"), { wrapper: wrapper(qc) });

    result.current.mutate("nc-2");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError.mock.calls[0]![1].description).toContain("nc fail");
    qc.clear();
  });
});

describe("useCancelarNotaCredito", () => {
  it("onSuccess: toast 'cancelada' e invalida caches", async () => {
    cancelarNotaCreditoFacturapi.mockResolvedValue({ ok: true });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCancelarNotaCredito("fac-2"), { wrapper: wrapper(qc) });

    result.current.mutate({ notaCreditoId: "nc-9", motivo: "02" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(cancelarNotaCreditoFacturapi).toHaveBeenCalledWith("nc-9", "02", undefined);
    expect(toastSuccess).toHaveBeenCalledWith("Nota de crédito cancelada");
    expect(spy).toHaveBeenCalledWith({ queryKey: facturasKeys.notasCredito("fac-2") });
    qc.clear();
  });

  it("cancelar NC onError: notifyError", async () => {
    cancelarNotaCreditoFacturapi.mockRejectedValue(new Error("cancel fail"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCancelarNotaCredito("fac-2"), { wrapper: wrapper(qc) });

    result.current.mutate({ notaCreditoId: "nc-10", motivo: "01", sustituyeUuid: "u-old" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError.mock.calls[0]![1].description).toContain("cancel fail");
    qc.clear();
  });

  it("uncertain: aviso informativo, invalida cache y no ofrece reintentar", async () => {
    cancelarNotaCreditoFacturapi.mockResolvedValue({
      ok: true,
      uncertain: true,
      pending: true,
      message: "FacturApi tardó en responder.",
    });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCancelarNotaCredito("fac-2"), { wrapper: wrapper(qc) });

    result.current.mutate({ notaCreditoId: "nc-11", motivo: "02" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(notifyInfo).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: "Cancelación de la NC enviada · verificando",
      description: "FacturApi tardó en responder.",
    }));
    expect(notifyInfo.mock.calls[0]![1].description).not.toMatch(/reintent/i);
    expect(spy).toHaveBeenCalledWith({ queryKey: facturasKeys.notasCredito("fac-2") });
    qc.clear();
  });
});
