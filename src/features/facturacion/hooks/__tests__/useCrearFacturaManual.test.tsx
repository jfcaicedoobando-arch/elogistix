/**
 * @vitest-environment jsdom
 *
 * Branches: timbrarAlGuardar true|false, success/error de cada paso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const crearFacturaManual = vi.fn();
const emitirFacturapi = vi.fn();
const toastSuccess = vi.fn();
const notifyError = vi.fn();

vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));
vi.mock("@/features/facturacion/services/facturaManual", () => ({
  crearFacturaManual: (...a: unknown[]) => crearFacturaManual(...a),
}));
vi.mock("@/features/facturacion/services/facturapi", () => ({
  emitirFacturapi: (...a: unknown[]) => emitirFacturapi(...a),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
  notifySuccess: (_t: unknown, opts: { title: string }) => toastSuccess(opts?.title),
}));

import { useCrearFacturaManual } from "../useCrearFacturaManual";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const fakeInput = { foo: "bar" } as never;

beforeEach(() => {
  crearFacturaManual.mockReset();
  emitirFacturapi.mockReset();
  toastSuccess.mockReset();
  notifyError.mockReset();
});

describe("useCrearFacturaManual", () => {
  it("timbrarAlGuardar=true: crea + emite, toast con UUID y resultado timbrada=true", async () => {
    crearFacturaManual.mockResolvedValue("fac-99");
    emitirFacturapi.mockResolvedValue({ uuid: "UUID9999-rest" });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCrearFacturaManual(), { wrapper: wrapper(qc) });

    result.current.mutate({ input: fakeInput, timbrarAlGuardar: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(crearFacturaManual).toHaveBeenCalledWith(fakeInput);
    expect(emitirFacturapi).toHaveBeenCalledWith("fac-99");
    expect(result.current.data).toEqual({ facturaId: "fac-99", timbrada: true, uuid: "UUID9999-rest" });
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("UUID9999"));
    qc.clear();
  });

  it("timbrarAlGuardar=false: sólo crea, toast 'borrador' y timbrada=false", async () => {
    crearFacturaManual.mockResolvedValue("fac-100");
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCrearFacturaManual(), { wrapper: wrapper(qc) });

    result.current.mutate({ input: fakeInput, timbrarAlGuardar: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(emitirFacturapi).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({ facturaId: "fac-100", timbrada: false });
    expect(toastSuccess).toHaveBeenCalledWith("Factura manual guardada como borrador");
    qc.clear();
  });

  it("error al crear: onError con mensaje", async () => {
    crearFacturaManual.mockRejectedValue(new Error("crear fail"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCrearFacturaManual(), { wrapper: wrapper(qc) });

    result.current.mutate({ input: fakeInput, timbrarAlGuardar: false });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError.mock.calls[0]![1].title).toContain("crear fail");
    qc.clear();
  });

  it("error al timbrar después de crear: onError con mensaje del timbrado", async () => {
    crearFacturaManual.mockResolvedValue("fac-200");
    emitirFacturapi.mockRejectedValue(new Error("timbrado fail"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCrearFacturaManual(), { wrapper: wrapper(qc) });

    result.current.mutate({ input: fakeInput, timbrarAlGuardar: true });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError.mock.calls[0]![1].title).toContain("timbrado fail");
    qc.clear();
  });
});
