import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearCacheSeguroFactura } from "@/test/helpers/seguroFacturaCache";

const svc = vi.hoisted(() => ({ crearPago: vi.fn(), editarPago: vi.fn(), borrarPago: vi.fn(), lote: vi.fn(), cerrar: vi.fn(), crearNc: vi.fn(), aprobarNc: vi.fn(), aplicarNc: vi.fn(), cancelarNc: vi.fn() }));
vi.mock("@/features/cxp/services", () => ({ registrarPagoProveedor: svc.crearPago, actualizarPagoProveedor: svc.editarPago, eliminarPagoProveedor: svc.borrarPago, listarPagosProveedor: vi.fn() }));
vi.mock("@/features/cxp/services/pagoProveedorLote", () => ({ registrarPagoProveedorLote: svc.lote }));
vi.mock("@/features/cxp/services/proveedorNotasCredito", () => ({ crearNotaCreditoProveedor: svc.crearNc, aprobarNotaCredito: svc.aprobarNc, aplicarNotaCredito: svc.aplicarNc, cancelarNotaCredito: svc.cancelarNc, fetchNotasCreditoFactura: vi.fn() }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "operador" } }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/hooks/shared", async () => ({ useMutationWithFeedback: (await import("@/hooks/shared/useMutationWithFeedback")).useMutationWithFeedback }));

import { useRegistrarPagoProveedor, useActualizarPagoProveedor, useEliminarPagoProveedor } from "../usePagosProveedor";
vi.mock("@/features/cxp/services/cerrarFacturaSinPago", () => ({ cerrarFacturaProveedorSinPago: svc.cerrar }));
import { useCerrarFacturaProveedorSinPago } from "../useCerrarFacturaSinPago";
import { usePagoProveedorLote } from "../usePagoProveedorLote";
import { useAplicarNotaCredito, useAprobarNotaCredito, useCancelarNotaCredito, useCrearNotaCredito } from "../useNotasCreditoProveedor";

let cache = crearCacheSeguroFactura();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache.client}>{children}</QueryClientProvider>;
beforeEach(() => { for (const mock of Object.values(svc)) mock.mockReset().mockResolvedValue({ id: "movimiento-a" }); });
afterEach(() => { cache.client.clear(); cache = crearCacheSeguroFactura(); });
function expectInvalidada() {
  for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(true);
  for (const key of cache.ajenas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
}
const pago = { proveedor_factura_id: "factura-a", fecha_pago: "2026-10-08", monto: 100, moneda: "MXN" as const, tipo_cambio_usd: null, metodo_pago: "Efectivo" };
function useOperaciones() {
  return {
    crearPago: useRegistrarPagoProveedor(), editarPago: useActualizarPagoProveedor("factura-a"),
    borrarPago: useEliminarPagoProveedor("factura-a"), lote: usePagoProveedorLote(), cerrar: useCerrarFacturaProveedorSinPago(),
    crearNc: useCrearNotaCredito("factura-a"), aprobarNc: useAprobarNotaCredito("factura-a"),
    aplicarNc: useAplicarNotaCredito("factura-a"), cancelarNc: useCancelarNotaCredito("factura-a"),
  };
}

describe("movimientos CxP refrescan P&L sin modificar su aritmética", () => {
  it("pago individual conserva importe, moneda y operador", async () => {
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => { await result.current.crearPago.mutateAsync(pago); });
    expect(svc.crearPago).toHaveBeenCalledWith(pago, "operador");
    expectInvalidada();
  });
  it("edición de pago conserva versión e importe", async () => {
    const { result } = renderHook(useOperaciones, { wrapper });
    const input = { ...pago, id: "pago-a", expectedUpdatedAt: "version-a" };
    await act(async () => { await result.current.editarPago.mutateAsync(input); });
    expect(svc.editarPago).toHaveBeenCalledWith(input, "operador");
    expectInvalidada();
  });
  it("borrado recuperable de pago conserva factura e identidad", async () => {
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => { await result.current.borrarPago.mutateAsync("pago-a"); });
    expect(svc.borrarPago).toHaveBeenCalledWith("pago-a", "factura-a", "operador");
    expectInvalidada();
  });
  it("pago en lote conserva cada asignación documental", async () => {
    const { result } = renderHook(useOperaciones, { wrapper });
    const input = { proveedor_id: "proveedor-a", fecha_pago: "2026-10-08", moneda: "MXN", metodo_pago: "Efectivo", referencia: "prueba", cuenta_bancaria_id: null, importe_recibido: 100, renglones: [{ factura_id: "factura-a", monto: 60 }, { factura_id: "factura-b", monto: 40 }] };
    await act(async () => { await result.current.lote.mutateAsync(input); });
    expect(svc.lote).toHaveBeenCalledWith(input);
    expectInvalidada();
  });
  it("cierre sin pago refresca el pago de ajuste sin cambiar motivo ni comentario", async () => {
    const { result } = renderHook(useOperaciones, { wrapper });
    const input = { facturaId: "factura-a", motivo: "ajuste_historico" as const, comentario: "Ajuste revisado" };
    await act(async () => { await result.current.cerrar.mutateAsync(input); });
    expect(svc.cerrar).toHaveBeenCalledWith(input);
    expectInvalidada();
  });
  it("un cierre sin pago rechazado no invalida ni se presenta como éxito", async () => {
    svc.cerrar.mockRejectedValue(new Error("No se cerró"));
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => { await expect(result.current.cerrar.mutateAsync({ facturaId: "factura-a", motivo: "compensacion" })).rejects.toThrow("No se cerró"); });
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
  });
  it("crear NC no reescribe subtotal ni monto", async () => {
    const { result } = renderHook(useOperaciones, { wrapper });
    const input = { proveedor_factura_id: "factura-a", organization_id: "org-a", fecha: "2026-10-08", subtotal: 10, monto: 11.6, moneda: "MXN" as const };
    await act(async () => { await result.current.crearNc.mutateAsync(input); });
    expect(svc.crearNc).toHaveBeenCalledWith(input);
    expectInvalidada();
  });
  it.each(["aprobarNc", "aplicarNc", "cancelarNc"] as const)("%s sólo refresca después del servicio", async (accion) => {
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => { await result.current[accion].mutateAsync("nc-a"); });
    expect(svc[accion]).toHaveBeenCalledWith("nc-a");
    expectInvalidada();
  });
  it("rechazo de pago conserva lecturas y no se convierte en éxito", async () => {
    svc.crearPago.mockRejectedValue(new Error("No se guardó"));
    const { result } = renderHook(useOperaciones, { wrapper });
    await act(async () => { await expect(result.current.crearPago.mutateAsync(pago)).rejects.toThrow("No se guardó"); });
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
