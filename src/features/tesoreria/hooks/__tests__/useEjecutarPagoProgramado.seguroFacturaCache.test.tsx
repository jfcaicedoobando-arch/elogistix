import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearCacheSeguroFactura } from "@/test/helpers/seguroFacturaCache";

const ejecutar = vi.hoisted(() => vi.fn());
vi.mock("@/features/tesoreria/services/ejecutarPagoProgramado", () => ({ ejecutarPagoProgramado: ejecutar }));
vi.mock("@/hooks/shared", async () => ({ useMutationWithFeedback: (await import("@/hooks/shared/useMutationWithFeedback")).useMutationWithFeedback }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
import { useEjecutarPagoProgramado } from "../useEjecutarPagoProgramado";

let cache = crearCacheSeguroFactura();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache.client}>{children}</QueryClientProvider>;
beforeEach(() => { ejecutar.mockReset().mockResolvedValue({ pago_id: "pago-a", movimiento_id: null, saldo_cuenta_restante: null }); });
afterEach(() => { cache.client.clear(); cache = crearCacheSeguroFactura(); });
const input = { facturaId: "factura-a", cuentaBancariaId: null, fecha: "2026-10-08", monto: 100, moneda: "MXN", metodoPago: "Efectivo", requestId: "request-a" };

describe("ejecutar pago programado refresca el P&L singular", () => {
  it("conserva payload, cuenta y requestId; refresca ambos embarques cacheados", async () => {
    const { result } = renderHook(useEjecutarPagoProgramado, { wrapper });
    await act(async () => { await result.current.mutateAsync(input); });
    expect(ejecutar).toHaveBeenCalledExactlyOnceWith(input);
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of cache.ajenas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
  });
  it("un rechazo no invalida ni se convierte en éxito", async () => {
    ejecutar.mockRejectedValue(new Error("No se ejecutó"));
    const { result } = renderHook(useEjecutarPagoProgramado, { wrapper });
    await act(async () => { await expect(result.current.mutateAsync(input)).rejects.toThrow("No se ejecutó"); });
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
