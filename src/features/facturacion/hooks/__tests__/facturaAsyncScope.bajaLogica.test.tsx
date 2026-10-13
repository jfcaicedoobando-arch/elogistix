import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const m = vi.hoisted(() => ({ crear: vi.fn(), timbrarNc: vi.fn(), registrarPago: vi.fn(), emitirRep: vi.fn(), toast: vi.fn() }));
vi.mock("@/features/facturacion/services/notasCredito", () => ({ crearNotaCredito: m.crear }));
vi.mock("@/features/facturacion/hooks/useNotaCreditoFacturapi", () => ({ useTimbrarNotaCredito: () => ({ mutateAsync: m.timbrarNc }) }));
vi.mock("@/features/facturacion/hooks", () => ({ useRegistrarPagoFactura: () => ({ mutateAsync: m.registrarPago, isPending: false }) }));
vi.mock("@/features/facturacion/services/repFacturapi", () => ({ emitirRep: m.emitirRep, esRepYaTimbrado: () => false }));
vi.mock("@/hooks/shared", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn(), notifyInfo: vi.fn(), notifyWarning: vi.fn() }));
import { useNotaCreditoSubmit } from "../useNotaCreditoSubmit";
import { useRegistrarPagoSubmit } from "../useRegistrarPagoSubmit";

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { resolve, promise }; }
let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={qc}>{children}</QueryClientProvider>; }
beforeEach(() => { vi.clearAllMocks(); qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); m.timbrarNc.mockResolvedValue({}); m.emitirRep.mockResolvedValue({}); });

describe("Independent review: no new fiscal step after deletion unmount", () => {
  it("NC: unmount while draft creation is pending prevents subsequent timbrado", async () => {
    const creation = deferred<{ id: string }>(); m.crear.mockReturnValue(creation.promise);
    const { result, unmount } = renderHook(() => useNotaCreditoSubmit({ facturaId: "invoice-a", onOpenChange: vi.fn() }), { wrapper });
    let submitted!: Promise<void>;
    act(() => { submitted = result.current.enviar(() => ({ factura_id: "invoice-a" }) as never, true); });
    await waitFor(() => expect(m.crear).toHaveBeenCalledOnce());
    expect(m.timbrarNc).not.toHaveBeenCalled();
    // Exactly what FacturaDetalleBody's vigencia key does on observed deleted_at.
    unmount();
    await act(async () => { creation.resolve({ id: "nc-a" }); await submitted; });
    expect(m.timbrarNc).not.toHaveBeenCalled();
  });
  it("Pago: unmount while payment registration is pending prevents subsequent REP", async () => {
    const registration = deferred<{ pagoId: string; movimientoBancario: string }>(); m.registrarPago.mockReturnValue(registration.promise);
    const { result, unmount } = renderHook(() => useRegistrarPagoSubmit(vi.fn()), { wrapper });
    let submitted!: Promise<void>;
    act(() => { submitted = result.current.submit({ facturaId: "invoice-a", facturaNumero: "A", fecha: "2026-10-13", monto: 100, moneda: "MXN", tipoCambio: 1, montoAplicado: 100, formaPago: "03", referencia: "", notas: "", esPpdTimbrada: true }); });
    expect(m.registrarPago).toHaveBeenCalledOnce();
    expect(m.emitirRep).not.toHaveBeenCalled();
    // Exactly what FacturaDetalleView's vigente conditional does on observed deleted_at.
    unmount();
    await act(async () => { registration.resolve({ pagoId: "payment-a", movimientoBancario: "no_aplica" }); await submitted; });
    expect(m.emitirRep).not.toHaveBeenCalled();
  });
});

const args = { facturaId: "invoice-a", facturaNumero: "A", fecha: "2026-10-13", monto: 100, moneda: "MXN" as const, tipoCambio: 1, montoAplicado: 100, formaPago: "03", referencia: "", notas: "", esPpdTimbrada: true };
describe("continuaciones por apertura e identidad", () => {
  it.each(["cerrar-reabrir", "A-B-A"])("NC: %s invalida la fase siguiente sin cerrar una apertura nueva", async (cambio) => {
    const creation = deferred<{ id: string }>(); m.crear.mockReturnValueOnce(creation.promise);
    const close = vi.fn();
    const { result, rerender } = renderHook(({ id, open }) => useNotaCreditoSubmit({ facturaId: id, open, onOpenChange: close }), { wrapper, initialProps: { id: "invoice-a", open: true } });
    let submitted!: Promise<void>;
    act(() => { submitted = result.current.enviar(() => ({ factura_id: "invoice-a" }) as never, true); });
    await waitFor(() => expect(m.crear).toHaveBeenCalledOnce());
    rerender({ id: cambio === "A-B-A" ? "invoice-b" : "invoice-a", open: cambio === "A-B-A" });
    rerender({ id: "invoice-a", open: true });
    expect(result.current.guardando).toBe(false);
    await act(async () => { creation.resolve({ id: "nc-a" }); await submitted; });
    expect(m.timbrarNc).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    m.crear.mockResolvedValueOnce({ id: "nc-nueva" });
    await act(async () => { await result.current.enviar(() => ({ factura_id: "invoice-a" }) as never, true); });
    expect(m.timbrarNc).toHaveBeenCalledWith("nc-nueva");
    expect(close).toHaveBeenCalledOnce();
  });
  it.each(["cerrar-reabrir", "A-B-A"])("Pago: %s invalida auto-REP y cierre tardío", async (cambio) => {
    const registration = deferred<{ pagoId: string; movimientoBancario: string }>(); m.registrarPago.mockReturnValueOnce(registration.promise);
    const close = vi.fn();
    const { result, rerender } = renderHook(({ id, open }) => useRegistrarPagoSubmit(close, { facturaId: id, open }), { wrapper, initialProps: { id: "invoice-a", open: true } });
    let submitted!: Promise<void>;
    act(() => { submitted = result.current.submit(args); });
    rerender({ id: cambio === "A-B-A" ? "invoice-b" : "invoice-a", open: cambio === "A-B-A" });
    rerender({ id: "invoice-a", open: true });
    await act(async () => { registration.resolve({ pagoId: "payment-a", movimientoBancario: "no_aplica" }); await submitted; });
    expect(m.emitirRep).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    m.registrarPago.mockResolvedValueOnce({ pagoId: "payment-nuevo", movimientoBancario: "no_aplica" });
    await act(async () => { await result.current.submit(args); });
    expect(m.emitirRep).toHaveBeenCalledWith("payment-nuevo");
    expect(close).toHaveBeenCalledOnce();
  });
  it("callbacks de submit capturados en A no inician escrituras después de A-B-A", async () => {
    const { result, rerender } = renderHook(({ id }) => ({
      nc: useNotaCreditoSubmit({ facturaId: id, open: true, onOpenChange: vi.fn() }),
      pago: useRegistrarPagoSubmit(vi.fn(), { facturaId: id, open: true }),
    }), { wrapper, initialProps: { id: "invoice-a" } });
    const previos = result.current;
    rerender({ id: "invoice-b" }); rerender({ id: "invoice-a" });
    await act(async () => {
      await previos.nc.enviar(() => ({ factura_id: "invoice-a" }) as never, true);
      await previos.pago.submit(args);
    });
    expect(m.crear).not.toHaveBeenCalled();
    expect(m.registrarPago).not.toHaveBeenCalled();
  });
  it("NC pendiente conserva invalidación de A aunque la vista ya sea B", async () => {
    const creation = deferred<{ id: string }>(); m.crear.mockReturnValueOnce(creation.promise);
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const { result, rerender } = renderHook(({ id }) => useNotaCreditoSubmit({ facturaId: id, open: true, onOpenChange: vi.fn() }), { wrapper, initialProps: { id: "invoice-a" } });
    let submitted!: Promise<void>;
    act(() => { submitted = result.current.enviar(() => ({ factura_id: "invoice-a" }) as never, true); });
    await waitFor(() => expect(m.crear).toHaveBeenCalledOnce());
    rerender({ id: "invoice-b" });
    await act(async () => { creation.resolve({ id: "nc-a" }); await submitted; });
    const invalidaciones = JSON.stringify(invalidate.mock.calls);
    expect(invalidaciones).toContain("invoice-a");
    expect(invalidaciones).not.toContain("invoice-b");
    expect(m.timbrarNc).not.toHaveBeenCalled();
  });
  it("un REP ya enviado puede terminar e invalidar A, sin cerrar la apertura nueva", async () => {
    m.registrarPago.mockResolvedValueOnce({ pagoId: "payment-a", movimientoBancario: "no_aplica" });
    const rep = deferred<object>(); m.emitirRep.mockReturnValueOnce(rep.promise);
    const invalidate = vi.spyOn(qc, "invalidateQueries"); const close = vi.fn();
    const { result, rerender } = renderHook(({ open }) => useRegistrarPagoSubmit(close, { facturaId: "invoice-a", open }), { wrapper, initialProps: { open: true } });
    let submitted!: Promise<void>;
    act(() => { submitted = result.current.submit(args); });
    await waitFor(() => expect(m.emitirRep).toHaveBeenCalledOnce());
    rerender({ open: false }); rerender({ open: true });
    expect(result.current.timbrandoRep).toBe(false);
    await act(async () => { rep.resolve({}); await submitted; });
    expect(m.emitirRep).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
