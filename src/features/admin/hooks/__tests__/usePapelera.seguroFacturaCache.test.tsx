import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearCacheSeguroFactura } from "@/test/helpers/seguroFacturaCache";

const svc = vi.hoisted(() => ({ restore: vi.fn(), purge: vi.fn(), toast: vi.fn() }));
vi.mock("@/features/admin/services", () => ({ listTrash: vi.fn(), listTrashCounts: vi.fn(), restoreRecord: svc.restore, purgeRecord: svc.purge }));
vi.mock("@/hooks/shared", () => ({ useToast: () => ({ toast: svc.toast }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));
import { usePapelera } from "../usePapelera";

let cache = crearCacheSeguroFactura();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache.client}>{children}</QueryClientProvider>;
beforeEach(() => { svc.restore.mockReset().mockResolvedValue(undefined); svc.purge.mockReset(); svc.toast.mockClear(); });
afterEach(() => { cache.client.clear(); cache = crearCacheSeguroFactura(); });

describe("restauración refresca las lecturas relacionadas con seguro", () => {
  it.each(["embarques", "seguros_embarque", "proveedor_facturas", "conceptos_costo", "proveedor_notas_credito", "pagos_proveedor"] as const)("%s conserva tabla e id y refresca", async (tabla) => {
    const { result } = renderHook(() => usePapelera(false), { wrapper });
    act(() => result.current.setTabla(tabla));
    await act(async () => { await result.current.restore.mutateAsync("registro-a"); });
    expect(svc.restore).toHaveBeenCalledWith(tabla, "registro-a");
    expect(svc.purge).not.toHaveBeenCalled();
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(true);
  });
  it("conserva la tabla restaurada si se cambia de pestaña mientras espera", async () => {
    let terminar!: () => void;
    svc.restore.mockReturnValue(new Promise<void>((resolve) => { terminar = resolve; }));
    const { result } = renderHook(() => usePapelera(false), { wrapper });
    act(() => result.current.setTabla("seguros_embarque"));
    let pending!: Promise<void>;
    act(() => { pending = result.current.restore.mutateAsync("registro-a"); });
    await waitFor(() => expect(svc.restore).toHaveBeenCalledWith("seguros_embarque", "registro-a"));
    act(() => result.current.setTabla("crm_leads"));
    await act(async () => { terminar(); await pending; });
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(true);
  });
  it("otra tabla no invalida P&L ni seguros", async () => {
    const { result } = renderHook(() => usePapelera(false), { wrapper });
    act(() => result.current.setTabla("crm_leads"));
    await act(async () => { await result.current.restore.mutateAsync("registro-a"); });
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
  });
  it("una restauración rechazada conserva la caché", async () => {
    svc.restore.mockRejectedValue(new Error("No se restauró"));
    const { result } = renderHook(() => usePapelera(false), { wrapper });
    act(() => result.current.setTabla("seguros_embarque"));
    await act(async () => { await expect(result.current.restore.mutateAsync("registro-a")).rejects.toThrow("No se restauró"); });
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(svc.toast).not.toHaveBeenCalled();
  });
});
