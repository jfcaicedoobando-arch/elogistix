/**
 * @vitest-environment jsdom
 *
 * Branches: timbrarAlGuardar true|false, success/error de cada paso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { CrearFacturaManualInput } from "@/features/facturacion/services/facturaManual";
import { MSG_PUE_REQUIERE_FORMA_REAL } from "@/lib/financial/formaMetodoPago";

const crearFacturaManual = vi.fn();
const emitirFacturapi = vi.fn();
const toastSuccess = vi.fn();
const successDescription = vi.fn();
const fetchClienteFiscal = vi.fn();
const notifyError = vi.fn();

vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));
vi.mock("@/features/facturacion/services/facturaManual", () => ({
  crearFacturaManual: (...a: unknown[]) => crearFacturaManual(...a),
}));
vi.mock("@/features/facturacion/services/datosFiscalesCliente", () => ({
  fetchClienteFiscal: (...a: unknown[]) => fetchClienteFiscal(...a),
}));
vi.mock("@/features/facturacion/services/facturapi", () => ({
  emitirFacturapi: (...a: unknown[]) => emitirFacturapi(...a),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
  notifySuccess: (_t: unknown, opts: { title: string; description?: string }) => { toastSuccess(opts?.title); successDescription(opts?.description); },
}));

import { useCrearFacturaManual } from "../useCrearFacturaManual";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const fakeInput: CrearFacturaManualInput = {
  organizationId: "org-1", clienteId: "cliente-1", clienteNombre: "Cliente de prueba",
  rfcCliente: "AAA010101AAA", serie: "A", usoCfdi: "G03", formaPago: "99", metodoPago: "PPD",
  diasCredito: 0, fechaEmision: "2026-10-04", moneda: "MXN", tipoCambio: 1, tasaIva: 0.16,
  conceptos: [{ descripcion: "Servicio", cantidad: 1, precio_unitario: 100, clave_sat: "78101800", tipo_iva: "gravado_16" }],
};

beforeEach(() => {
  crearFacturaManual.mockReset();
  fetchClienteFiscal.mockReset();
  fetchClienteFiscal.mockResolvedValue({ rfc: "AAA010101AAA", regimen_fiscal: "601", codigo_postal: "64000" });
  successDescription.mockReset();
  emitirFacturapi.mockReset();
  toastSuccess.mockReset();
  notifyError.mockReset();
});

describe("useCrearFacturaManual", () => {
  it("AUD51: rechaza PUE/99 antes de crear factura, conceptos o timbrar", async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCrearFacturaManual(), { wrapper: wrapper(qc) });

    result.current.mutate({ input: { ...fakeInput, metodoPago: "PUE" }, timbrarAlGuardar: true });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(crearFacturaManual).not.toHaveBeenCalled();
    expect(emitirFacturapi).not.toHaveBeenCalled();
    expect(result.current.error?.message).toBe(MSG_PUE_REQUIERE_FORMA_REAL);
    qc.clear();
  });

  it.each([
    { metodoPago: "PUE", formaPago: "03" },
    { metodoPago: "PPD", formaPago: "99" },
  ])("AUD51: permite crear y timbrar $metodoPago/$formaPago", async (pareja) => {
    crearFacturaManual.mockResolvedValue("fac-valida");
    emitirFacturapi.mockResolvedValue({ uuid: "UUID-VALIDO", folio: 1 });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCrearFacturaManual(), { wrapper: wrapper(qc) });
    const input = { ...fakeInput, ...pareja };

    result.current.mutate({ input, timbrarAlGuardar: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(crearFacturaManual).toHaveBeenCalledWith(input);
    expect(emitirFacturapi).toHaveBeenCalledWith("fac-valida");
    qc.clear();
  });

  it("AUD51: guardar sólo borrador permite completar los datos fiscales después", async () => {
    crearFacturaManual.mockResolvedValue("fac-borrador");
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCrearFacturaManual(), { wrapper: wrapper(qc) });
    const input = { ...fakeInput, metodoPago: "PUE", formaPago: "" };

    result.current.mutate({ input, timbrarAlGuardar: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(crearFacturaManual).toHaveBeenCalledWith(input);
    expect(emitirFacturapi).not.toHaveBeenCalled();
    qc.clear();
  });

  it("timbrarAlGuardar=true: crea + emite, toast con UUID y resultado timbrada=true", async () => {
    crearFacturaManual.mockResolvedValue("fac-99");
    emitirFacturapi.mockResolvedValue({ uuid: "UUID9999-rest", folio: 991 });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCrearFacturaManual(), { wrapper: wrapper(qc) });

    result.current.mutate({ input: fakeInput, timbrarAlGuardar: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(crearFacturaManual).toHaveBeenCalledWith(fakeInput);
    expect(emitirFacturapi).toHaveBeenCalledWith("fac-99");
    expect(result.current.data).toEqual({ facturaId: "fac-99", timbrada: true, uuid: "UUID9999-rest", timbrado: { uuid: "UUID9999-rest", folio: 991 } });
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

  it("timbrado sin folio/UUID: error explícito en vez de toast 'timbrada'", async () => {
    crearFacturaManual.mockResolvedValue("fac-101");
    emitirFacturapi.mockResolvedValue({ uuid: null, folio: null });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCrearFacturaManual(), { wrapper: wrapper(qc) });

    result.current.mutate({ input: fakeInput, timbrarAlGuardar: true });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError.mock.calls[0]![1].description).toContain("no devolvió folio fiscal");
    expect(toastSuccess).not.toHaveBeenCalled();
    qc.clear();
  });

  it("error al crear: onError con mensaje", async () => {
    crearFacturaManual.mockRejectedValue(new Error("crear fail"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCrearFacturaManual(), { wrapper: wrapper(qc) });

    result.current.mutate({ input: fakeInput, timbrarAlGuardar: false });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError.mock.calls[0]![1].description).toContain("crear fail");
    qc.clear();
  });

  it("error al timbrar después de crear: onError con mensaje del timbrado", async () => {
    crearFacturaManual.mockResolvedValue("fac-200");
    emitirFacturapi.mockRejectedValue(new Error("timbrado fail"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCrearFacturaManual(), { wrapper: wrapper(qc) });

    result.current.mutate({ input: fakeInput, timbrarAlGuardar: true });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError.mock.calls[0]![1].description).toContain("timbrado fail");
    qc.clear();
  });
});
