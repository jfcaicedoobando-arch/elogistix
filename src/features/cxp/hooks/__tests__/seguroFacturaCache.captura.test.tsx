import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearCacheSeguroFactura } from "@/test/helpers/seguroFacturaCache";

const svc = vi.hoisted(() => ({ submit: vi.fn(), crear: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(() => { throw new Error("I/O no simulado"); }), rpc: vi.fn(() => { throw new Error("RPC no simulado"); }) } }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "operador" } }) }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org-a" }) }));
vi.mock("@/features/cxp/hooks", () => ({ useCrearFacturaProveedor: () => ({ mutateAsync: svc.crear, isPending: false }) }));
vi.mock("@/features/cxp/services", () => ({}));
vi.mock("@/features/proveedor/services", () => ({ findProveedorByRfcEnOrg: vi.fn() }));
vi.mock("../useNuevaFacturaProveedorForm.submit", () => ({ runSubmit: svc.submit }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notifyWarning: vi.fn() }));
import { useNuevaFacturaProveedorForm } from "../useNuevaFacturaProveedorForm";

let cache = crearCacheSeguroFactura();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache.client}>{children}</QueryClientProvider>;
beforeEach(() => { svc.submit.mockReset(); svc.crear.mockReset(); });
afterEach(() => { cache.client.clear(); cache = crearCacheSeguroFactura(); });
function capturar(result: { current: ReturnType<typeof useNuevaFacturaProveedorForm> }) {
  act(() => {
    result.current.handleProveedor("proveedor-a", "Aseguradora");
    result.current.handleChange("folio", "F-1");
    result.current.handleChange("categoriaId", "categoria-a");
    result.current.conceptosManuales.reemplazar([{ descripcion: "Prima", cantidad: 1, importe: 100, iva: 16, ieps: 0 }]);
  });
  act(() => result.current.totalesManuales.aplicar());
}

describe("captura refresca al terminar conceptos y vínculos", () => {
  it("espera el resultado del pipeline; refresca antes del cierre posterior y conserva formulario si ese cierre queda pendiente", async () => {
    let terminar!: (value: { ok: boolean; facturaId: string }) => void;
    svc.submit.mockReturnValue(new Promise((resolve) => { terminar = resolve; }));
    let invalidadaAlCerrar = false;
    const onDone = vi.fn(() => {
      invalidadaAlCerrar = cache.afectadas.every((key) => cache.client.getQueryState(key)?.isInvalidated);
      return false;
    });
    const { result } = renderHook(() => useNuevaFacturaProveedorForm(onDone), { wrapper });
    capturar(result);
    let pending!: Promise<void>;
    act(() => { pending = result.current.submit(); });
    await waitFor(() => expect(svc.submit).toHaveBeenCalledTimes(1));
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => { terminar({ ok: true, facturaId: "factura-a" }); await pending; });
    expect(onDone).toHaveBeenCalledExactlyOnceWith("factura-a");
    expect(invalidadaAlCerrar).toBe(true);
    expect(result.current.values.folio).toBe("F-1");
  });
  it("un pipeline sin éxito conserva la caché y no llama al cierre", async () => {
    svc.submit.mockResolvedValue({ ok: false, facturaId: null });
    const onDone = vi.fn();
    const { result } = renderHook(() => useNuevaFacturaProveedorForm(onDone), { wrapper });
    capturar(result);
    await act(async () => { await result.current.submit(); });
    expect(svc.submit).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
