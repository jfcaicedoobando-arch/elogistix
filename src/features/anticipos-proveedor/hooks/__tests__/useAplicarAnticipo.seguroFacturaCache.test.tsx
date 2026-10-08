import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearCacheSeguroFactura } from "@/test/helpers/seguroFacturaCache";

const svc = vi.hoisted(() => ({ aplicar: vi.fn(), get: vi.fn(), reset: vi.fn() }));
vi.mock("@/features/anticipos-proveedor/services/anticiposProveedorService", () => ({ aplicarAnticipo: svc.aplicar }));
vi.mock("@/lib/idempotency", () => ({ usePayloadRequestId: () => ({ get: svc.get, reset: svc.reset }), scopeDePayload: (parts: unknown[]) => JSON.stringify(parts) }));
vi.mock("@/hooks/shared", async () => ({ useMutationWithFeedback: (await import("@/hooks/shared/useMutationWithFeedback")).useMutationWithFeedback }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
import { useAplicarAnticipo } from "../useAnticipoProveedorMutations";

let cache = crearCacheSeguroFactura();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache.client}>{children}</QueryClientProvider>;
beforeEach(() => { svc.aplicar.mockReset().mockResolvedValue("aplicacion-a"); svc.get.mockReset().mockReturnValue("request-a"); svc.reset.mockClear(); });
afterEach(() => { cache.client.clear(); cache = crearCacheSeguroFactura(); });
const input = { anticipoId: "anticipo-a", facturaId: "factura-a", monto: 100, fechaAplicacion: "2026-10-08" };

describe("aplicar anticipo refresca P&L tras el pago generado", () => {
  it("conserva destino, importe, fecha y llave idempotente", async () => {
    const { result } = renderHook(useAplicarAnticipo, { wrapper });
    await act(async () => { await result.current.mutateAsync(input); });
    expect(svc.aplicar).toHaveBeenCalledWith("anticipo-a", "factura-a", 100, "2026-10-08", "request-a");
    expect(svc.get).toHaveBeenCalledWith(JSON.stringify(["anticipo-a", "factura-a", 100, "2026-10-08"]));
    expect(svc.reset).toHaveBeenCalledTimes(1);
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of cache.ajenas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
  });
  it("el rechazo conserva caché y llave para reintento", async () => {
    svc.aplicar.mockRejectedValue(new Error("No se aplicó"));
    const { result } = renderHook(useAplicarAnticipo, { wrapper });
    await act(async () => { await expect(result.current.mutateAsync(input)).rejects.toThrow("No se aplicó"); });
    expect(svc.reset).not.toHaveBeenCalled();
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
