import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearCacheSeguroFactura } from "@/test/helpers/seguroFacturaCache";

const svc = vi.hoisted(() => ({ crear: vi.fn(), editar: vi.fn(), borrar: vi.fn(), cancelar: vi.fn(), conceptos: vi.fn(), aprobar: vi.fn() }));
vi.mock("@/features/cxp/services", () => ({
  crearFacturaProveedor: svc.crear, actualizarFacturaProveedor: svc.editar,
  softDeleteFacturaProveedor: svc.borrar, SaldoNegativoError: class extends Error {},
}));
vi.mock("@/features/cxp/services/cancelarFacturaProveedor", () => ({ cancelarFacturaProveedor: svc.cancelar }));
vi.mock("@/features/cxp/services/conceptosFacturaEditar", () => ({ reemplazarConceptosFactura: svc.conceptos }));
vi.mock("@/features/cxp/services/aprobacionFactura", () => ({ aprobarFacturaProveedor: svc.aprobar, AprobacionFacturaError: class extends Error {} }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "operador" } }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notifyWarning: vi.fn() }));

import { useCrearFacturaProveedor, useActualizarFacturaProveedor, useEliminarFacturaProveedor } from "../useFacturaProveedorMutations";
import { useCancelarFacturaProveedor } from "../useCancelarFacturaProveedor";
import { useEditarConceptosFactura } from "../useEditarConceptosFactura";
import { useAprobarFactura } from "../useAprobarFactura";
import { useAprobarFacturasLote } from "../useAprobarFacturasLote";

let cache = crearCacheSeguroFactura();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache.client}>{children}</QueryClientProvider>;
beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of Object.values(svc)) mock.mockReset().mockResolvedValue({ id: "factura-a" });
});
afterEach(() => { cache.client.clear(); cache = crearCacheSeguroFactura(); });
function expectInvalidada() {
  for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(true);
}

const payloadEdicion = { folio_proveedor: "F-1", fecha_emision: "2026-10-08", fecha_vencimiento: "2026-11-08", dias_credito: 30, moneda: "MXN" as const, tipo_cambio_usd: 1, subtotal: 100, iva: 16, ieps: 0, retenciones: 0, categoria_presupuesto_id: "categoria-a", notas: "" };

function useOperaciones() {
  return {
    crear: useCrearFacturaProveedor(), editar: useActualizarFacturaProveedor(), borrar: useEliminarFacturaProveedor(),
    cancelar: useCancelarFacturaProveedor(), conceptos: useEditarConceptosFactura("factura-a"),
    aprobar: useAprobarFactura(), lote: useAprobarFacturasLote(),
  };
}

describe("documentos CxP refrescan seguros y P&L", () => {
  it("alta conserva el payload y refresca ambos embarques", async () => {
    const { result } = renderHook(useOperaciones, { wrapper });
    const input = { proveedor_id: "proveedor-a", categoria_presupuesto_id: "categoria-a", folio_proveedor: "F-1", organization_id: "org-a", moneda: "MXN" as const, subtotal: 100, total: 116 };
    await act(async () => { await result.current.crear.mutateAsync(input); });
    expect(svc.crear).toHaveBeenCalledWith(input);
    expectInvalidada();
  });
  it("edición conserva la versión revisada", async () => {
    const { result } = renderHook(useOperaciones, { wrapper });
    const payload = payloadEdicion;
    await act(async () => { await result.current.editar.mutateAsync({ id: "factura-a", payload, expectedUpdatedAt: "version-a" }); });
    expect(svc.editar).toHaveBeenCalledWith("factura-a", payload, "version-a");
    expectInvalidada();
  });
  it("borrado recuperable conserva identidad del operador", async () => {
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => { await result.current.borrar.mutateAsync("factura-a"); });
    expect(svc.borrar).toHaveBeenCalledWith("factura-a", "operador");
    expectInvalidada();
  });
  it("cancelación refresca también el árbol singular", async () => {
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => { await result.current.cancelar.mutateAsync({ facturaId: "factura-a", motivo: "Corrección" }); });
    expect(svc.cancelar).toHaveBeenCalledWith("factura-a", "Corrección");
    expectInvalidada();
  });
  it("edición fiscal refresca sin cambiar conceptos ni versión", async () => {
    const { result } = renderHook(useOperaciones, { wrapper });
    const input = { conceptos: [{ descripcion: "Prima", cantidad: 1, importe: 100, iva: 16, ieps: 0 }], expectedUpdatedAt: "version-a" };
    await act(async () => { await result.current.conceptos.mutateAsync(input); });
    expect(svc.conceptos).toHaveBeenCalledWith({ ...input, facturaId: "factura-a" });
    expectInvalidada();
  });
  it.each([true, false])("aprobación/rechazo %s refresca después de confirmar el servicio", async (aprobar) => {
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => { await result.current.aprobar.mutateAsync({ id: "factura-a", aprobar, expectedUpdatedAt: "version-a" }); });
    expect(svc.aprobar).toHaveBeenCalledWith("factura-a", aprobar, undefined, "version-a");
    expectInvalidada();
  });
  it("lote parcialmente exitoso refresca; conserva éxitos y fallos", async () => {
    svc.aprobar.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("No se guardó"));
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => {
      expect(await result.current.lote.aprobar(["factura-a", "factura-b"])).toEqual({ exitos: ["factura-a"], fallos: [{ id: "factura-b", error: "No se guardó" }] });
    });
    expectInvalidada();
  });
  it("un lote totalmente fallido no invalida las lecturas de seguro", async () => {
    svc.aprobar.mockRejectedValue(new Error("No se guardó"));
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => { await result.current.lote.aprobar(["factura-a"]); });
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
  });
  it("un error de escritura no invalida ni cambia el dato del selector", async () => {
    svc.editar.mockRejectedValue(new Error("No se guardó"));
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => { await expect(result.current.editar.mutateAsync({ id: "factura-a", payload: payloadEdicion })).rejects.toThrow("No se guardó"); });
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
  });
  it("si el servidor confirma que ya fue borrada, refresca sin fingir éxito", async () => {
    svc.borrar.mockRejectedValue(new Error("LC_FACTURA_PROVEEDOR_NOT_FOUND"));
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => { await expect(result.current.borrar.mutateAsync("factura-a")).rejects.toThrow("LC_FACTURA_PROVEEDOR_NOT_FOUND"); });
    expectInvalidada();
  });
});
