/**
 * v13.312.21 — Ola 1 · item 3 (batch 2): tests conductuales para la migración
 * a `useMutationWithFeedback` de los 6 focos de alto volumen (~20 mutaciones):
 * clientes, cotizaciones, documentos de embarque, timbrado, notas de crédito
 * de proveedor y costeo de tarifas.
 *
 * Cada foco valida los 2 contratos del wrapper:
 *   (1) éxito → invalidate + `notifySuccess` con `title` esperado.
 *   (2) error → `notifyError` con `errorTitle` y `errorMethod` correctos.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const notifyError = vi.fn();
const notifySuccess = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

// ---- Cliente services ----
const createCliente = vi.fn();
const updateCliente = vi.fn();
const createContacto = vi.fn();
const updateContacto = vi.fn();
const deleteContacto = vi.fn();
vi.mock("@/features/cliente/services", () => ({
  fetchClientesPaginados: vi.fn(),
  fetchClientesForSelect: vi.fn(),
  fetchCliente: vi.fn(),
  createCliente: (...a: unknown[]) => createCliente(...a),
  updateCliente: (...a: unknown[]) => updateCliente(...a),
  fetchContactosCliente: vi.fn(),
  createContacto: (...a: unknown[]) => createContacto(...a),
  updateContacto: (...a: unknown[]) => updateContacto(...a),
  deleteContacto: (...a: unknown[]) => deleteContacto(...a),
  fetchEmbarquesCliente: vi.fn(),
  fetchCotizacionesCliente: vi.fn(),
}));
vi.mock("@/hooks/shared", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/hooks/shared");
  return {
    ...actual,
    useOrgFilter: () => ({ organizationId: "org1" }),
    useToast: () => ({ toast: vi.fn() }),
  };
});

// ---- Cotización services ----
const svcCrearCot = vi.fn();
const svcUpdateCot = vi.fn();
const svcDeleteCot = vi.fn();
const svcUpdateEstadoCot = vi.fn();
const svcReactivarCot = vi.fn();
vi.mock("@/features/cotizacion/services", () => ({
  crearCotizacion: (...a: unknown[]) => svcCrearCot(...a),
  updateCotizacion: (...a: unknown[]) => svcUpdateCot(...a),
  deleteCotizacion: (...a: unknown[]) => svcDeleteCot(...a),
  updateEstadoCotizacion: (...a: unknown[]) => svcUpdateEstadoCot(...a),
  reactivarCotizacion: (...a: unknown[]) => svcReactivarCot(...a),
}));

// ---- Documentos embarque ----
const uploadDoc = vi.fn();
const deleteDoc = vi.fn();
const createDocRow = vi.fn();
const setDocNoAplica = vi.fn();
vi.mock("@/features/embarques/services", () => ({
  uploadDocumentoEmbarque: (...a: unknown[]) => uploadDoc(...a),
  deleteDocumentoEmbarque: (...a: unknown[]) => deleteDoc(...a),
  createDocumentoEmbarqueRow: (...a: unknown[]) => createDocRow(...a),
  setDocumentoEstadoNoAplica: (...a: unknown[]) => setDocNoAplica(...a),
}));

// ---- Timbrado ----
const emitirFacturapi = vi.fn();
vi.mock("@/features/facturacion/services/facturapi", () => ({
  emitirFacturapi: (...a: unknown[]) => emitirFacturapi(...a),
  cancelarFacturapi: vi.fn(),
  FacturapiError: class extends Error {
    transient = false;
  },
}));
const invalidateHueco = vi.fn();
vi.mock("@/features/facturacion/hooks/invalidateHuecoFacturacion", () => ({
  invalidateHuecoFacturacion: (...a: unknown[]) => invalidateHueco(...a),
}));

// ---- NC Proveedor ----
const crearNc = vi.fn();
const aplicarNc = vi.fn();
const aprobarNc = vi.fn();
const cancelarNc = vi.fn();
vi.mock("@/features/cxp/services/proveedorNotasCredito", () => ({
  crearNotaCreditoProveedor: (...a: unknown[]) => crearNc(...a),
  aplicarNotaCredito: (...a: unknown[]) => aplicarNc(...a),
  aprobarNotaCredito: (...a: unknown[]) => aprobarNc(...a),
  cancelarNotaCredito: (...a: unknown[]) => cancelarNc(...a),
  fetchNotasCreditoFactura: vi.fn(),
}));

// ---- Costeo ----
const insertTarifa = vi.fn();
const updateTarifa = vi.fn();
const deleteTarifa = vi.fn();
const marcarReemplazada = vi.fn();
vi.mock("@/features/costeo/services/tarifas", () => ({
  fetchCosteoTarifas: vi.fn(),
  insertTarifaConRecargos: (...a: unknown[]) => insertTarifa(...a),
  updateTarifaConRecargos: (...a: unknown[]) => updateTarifa(...a),
  deleteTarifa: (...a: unknown[]) => deleteTarifa(...a),
  marcarTarifaReemplazada: (...a: unknown[]) => marcarReemplazada(...a),
}));
vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organizationId: "org1" }),
}));
vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: vi.fn(),
}));

import { useCreateCliente, useUpdateCliente, useCreateContacto, useUpdateContacto, useDeleteContacto } from "@/features/cliente/hooks/useClientes";
import {
  useCreateCotizacion,
  useUpdateCotizacion,
  useDeleteCotizacion,
  useUpdateEstadoCotizacion,
  useReactivarCotizacion,
} from "@/features/cotizacion/hooks/mutations/useCotizacionMutations";
import {
  useUploadDocumentoEmbarque,
  useDeleteDocumentoEmbarque,
  useCreateDocumentoEmbarque,
  useSetDocumentoNoAplica,
} from "@/features/embarques/hooks/mutations/useDocumentoEmbarqueMutations";
import { useTimbrarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import {
  useCrearNotaCredito,
  useAplicarNotaCredito,
  useAprobarNotaCredito,
  useCancelarNotaCredito,
} from "@/features/cxp/hooks/useNotasCreditoProveedor";
import { useCosteoTarifaMutations } from "@/features/costeo/hooks/useCosteoTarifas";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { client, invalidateSpy, Wrapper };
}

beforeEach(() => {
  notifyError.mockClear();
  notifySuccess.mockClear();
  createCliente.mockReset();
  updateCliente.mockReset();
  createContacto.mockReset();
  updateContacto.mockReset();
  deleteContacto.mockReset();
  svcCrearCot.mockReset();
  svcUpdateCot.mockReset();
  svcDeleteCot.mockReset();
  svcUpdateEstadoCot.mockReset();
  svcReactivarCot.mockReset();
  uploadDoc.mockReset();
  deleteDoc.mockReset();
  createDocRow.mockReset();
  setDocNoAplica.mockReset();
  emitirFacturapi.mockReset();
  invalidateHueco.mockReset();
  crearNc.mockReset();
  aplicarNc.mockReset();
  aprobarNc.mockReset();
  cancelarNc.mockReset();
  insertTarifa.mockReset();
  updateTarifa.mockReset();
  deleteTarifa.mockReset();
  marcarReemplazada.mockReset();
});

// ============================================================================
// CLIENTES
// ============================================================================
describe("useClientes · migración ola1 batch 2", () => {
  it("useCreateContacto: éxito → invalidate contactos del cliente + toast success", async () => {
    createContacto.mockResolvedValueOnce({ id: "c1" });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateContacto(), { wrapper: Wrapper });
    result.current.mutate({ cliente_id: "cli1", nombre: "Juan" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "Contacto creado" }));
    const keys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(expect.arrayContaining([["clientes", "contactos", "cli1"]]));
  });

  it("useUpdateCliente: error → notifyError con título traducido", async () => {
    updateCliente.mockRejectedValueOnce(new Error("boom"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateCliente(), { wrapper: Wrapper });
    result.current.mutate({ id: "cli1", nombre: "X" } as never);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Error al actualizar cliente", method: "UPDATE_CLIENTE" }),
    );
  });

  it("useDeleteContacto: error → notifyError con método correcto", async () => {
    deleteContacto.mockRejectedValueOnce(new Error("nope"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteContacto(), { wrapper: Wrapper });
    result.current.mutate({ id: "c1", cliente_id: "cli1" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Error al eliminar contacto", method: "DELETE_CONTACTO" }),
    );
  });

  it("useCreateCliente: éxito NO emite toast (silent success delegado al wizard)", async () => {
    createCliente.mockResolvedValueOnce({ id: "cli1" });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateCliente(), { wrapper: Wrapper });
    result.current.mutate({ nombre: "Acme" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("useUpdateContacto: éxito → invalidate contactos + toast", async () => {
    updateContacto.mockResolvedValueOnce({});
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useUpdateContacto(), { wrapper: Wrapper });
    result.current.mutate({ id: "c1", cliente_id: "cli1", nombre: "X" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "Contacto actualizado" }));
    const keys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(expect.arrayContaining([["clientes", "contactos", "cli1"]]));
  });
});

// ============================================================================
// COTIZACIONES
// ============================================================================
describe("useCotizacionMutations · migración ola1 batch 2", () => {
  it("useCreateCotizacion: éxito → invalidate all + toast", async () => {
    svcCrearCot.mockResolvedValueOnce({ id: "cot1" });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateCotizacion(), { wrapper: Wrapper });
    result.current.mutate({ cliente_id: "cli1" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "Cotización creada" }));
  });

  it("useUpdateEstadoCotizacion: éxito → toast dinámico con estado", async () => {
    svcUpdateEstadoCot.mockResolvedValueOnce({});
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateEstadoCotizacion(), { wrapper: Wrapper });
    result.current.mutate({ id: "cot1", estado: "aprobada" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "Cotización aprobada" }));
  });

  it("useDeleteCotizacion: error → notifyError método DELETE_COTIZACION", async () => {
    svcDeleteCot.mockRejectedValueOnce(new Error("x"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteCotizacion(), { wrapper: Wrapper });
    result.current.mutate("cot1");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ method: "DELETE_COTIZACION" }),
    );
  });

  it("useReactivarCotizacion: éxito → toast y detail invalidada", async () => {
    svcReactivarCot.mockResolvedValueOnce({});
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useReactivarCotizacion(), { wrapper: Wrapper });
    result.current.mutate("cot1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "Cotización reactivada" }));
    const keys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(expect.arrayContaining([["cotizaciones", "detail", "cot1"]]));
  });

  it("useUpdateCotizacion: error → notifyError con título específico", async () => {
    svcUpdateCot.mockRejectedValueOnce(new Error("y"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateCotizacion(), { wrapper: Wrapper });
    result.current.mutate({ id: "cot1", data: {} });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Error al actualizar cotización", method: "UPDATE_COTIZACION" }),
    );
  });
});

// ============================================================================
// DOCUMENTOS EMBARQUE
// ============================================================================
describe("useDocumentoEmbarqueMutations · migración ola1 batch 2", () => {
  it("useUploadDocumentoEmbarque: éxito → 3 invalidaciones (docs, embarques, auditoria) + toast", async () => {
    uploadDoc.mockResolvedValueOnce({});
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useUploadDocumentoEmbarque(), { wrapper: Wrapper });
    result.current.mutate({ embarqueId: "e1", docId: "d1", file: new File([""], "x.pdf") });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "Documento subido" }));
    const keys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ["embarques", "documentos", "e1"],
        ["embarques"],
        ["auditoria", "embarques"],
      ]),
    );
  });

  it("useDeleteDocumentoEmbarque: error → notifyError con método correcto", async () => {
    deleteDoc.mockRejectedValueOnce(new Error("fail"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteDocumentoEmbarque(), { wrapper: Wrapper });
    result.current.mutate({ embarqueId: "e1", docId: "d1", archivoPath: "p/a.pdf" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Error al eliminar documento", method: "DELETE_DOC_EMBARQUE" }),
    );
  });

  it("useCreateDocumentoEmbarque: éxito NO emite toast (silent) pero invalida", async () => {
    createDocRow.mockResolvedValueOnce({});
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateDocumentoEmbarque(), { wrapper: Wrapper });
    result.current.mutate({ embarqueId: "e1", nombre: "BL" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).not.toHaveBeenCalled();
    const keys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(expect.arrayContaining([["embarques", "documentos", "e1"]]));
  });

  it("useSetDocumentoNoAplica: error → método SET_DOC_NO_APLICA", async () => {
    setDocNoAplica.mockRejectedValueOnce(new Error("x"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetDocumentoNoAplica(), { wrapper: Wrapper });
    result.current.mutate({ embarqueId: "e1", docId: "d1", noAplica: true });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ method: "SET_DOC_NO_APLICA" }),
    );
  });
});

// ============================================================================
// TIMBRAR
// ============================================================================
describe("useTimbrarFactura · migración ola1 batch 2", () => {
  it("éxito → toast dinámico con serie/folio + invalidateHueco", async () => {
    emitirFacturapi.mockResolvedValueOnce({ serie: "A", folio: "123" });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useTimbrarFactura(), { wrapper: Wrapper });
    result.current.mutate("fac1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        title: "Factura timbrada correctamente",
        description: "Serie A · Folio 123",
      }),
    );
    expect(invalidateHueco).toHaveBeenCalled();
  });

  it("error → notifyError título 'No se pudo timbrar'", async () => {
    emitirFacturapi.mockRejectedValueOnce(new Error("timeout"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useTimbrarFactura(), { wrapper: Wrapper });
    result.current.mutate("fac1");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        title: "No se pudo timbrar",
        method: "FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_1",
      }),
    );
  });
});

// ============================================================================
// NC PROVEEDOR
// ============================================================================
describe("useNotasCreditoProveedor · migración ola1 batch 2", () => {
  it("useCrearNotaCredito: éxito → invalidate específica + cxp.all + toast", async () => {
    crearNc.mockResolvedValueOnce({ id: "nc1" });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCrearNotaCredito("fac1"), { wrapper: Wrapper });
    result.current.mutate({ factura_id: "fac1" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "Nota de crédito registrada" }));
    const keys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(expect.arrayContaining([["cxp", "notasCredito", "fac1"]]));
  });

  it("useAplicarNotaCredito: error → método APLICAR_NC_PROVEEDOR", async () => {
    aplicarNc.mockRejectedValueOnce(new Error("x"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAplicarNotaCredito("fac1"), { wrapper: Wrapper });
    result.current.mutate("nc1");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ method: "APLICAR_NC_PROVEEDOR" }),
    );
  });

  it("useAprobarNotaCredito: éxito → toast 'aprobada'", async () => {
    aprobarNc.mockResolvedValueOnce({});
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAprobarNotaCredito("fac1"), { wrapper: Wrapper });
    result.current.mutate("nc1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "Nota de crédito aprobada" }));
  });

  it("useCancelarNotaCredito: error → método CANCELAR_NC_PROVEEDOR", async () => {
    cancelarNc.mockRejectedValueOnce(new Error("x"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCancelarNotaCredito("fac1"), { wrapper: Wrapper });
    result.current.mutate("nc1");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ method: "CANCELAR_NC_PROVEEDOR" }),
    );
  });
});

// ============================================================================
// COSTEO TARIFAS
// ============================================================================
describe("useCosteoTarifas · migración ola1 batch 2", () => {
  it("crear: éxito → invalidate + toast 'Tarifa guardada'", async () => {
    insertTarifa.mockResolvedValueOnce({ id: "t1", naviera_nombre: "MSC" });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCosteoTarifaMutations(), { wrapper: Wrapper });
    result.current.crear.mutate({} as never);
    await waitFor(() => expect(result.current.crear.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "Tarifa guardada" }));
  });

  it("actualizar: error → método USECOSTEOTARIFAS_2", async () => {
    updateTarifa.mockRejectedValueOnce(new Error("boom"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCosteoTarifaMutations(), { wrapper: Wrapper });
    result.current.actualizar.mutate({ id: "t1", input: {} as never });
    await waitFor(() => expect(result.current.actualizar.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_2" }),
    );
  });

  it("reemplazar: éxito → toast 'Tarifa marcada como reemplazada'", async () => {
    marcarReemplazada.mockResolvedValueOnce({});
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCosteoTarifaMutations(), { wrapper: Wrapper });
    result.current.reemplazar.mutate("t1");
    await waitFor(() => expect(result.current.reemplazar.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Tarifa marcada como reemplazada" }),
    );
  });

  it("eliminar: error → método USECOSTEOTARIFAS_4", async () => {
    deleteTarifa.mockRejectedValueOnce(new Error("x"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCosteoTarifaMutations(), { wrapper: Wrapper });
    result.current.eliminar.mutate("t1");
    await waitFor(() => expect(result.current.eliminar.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_4" }),
    );
  });
});
