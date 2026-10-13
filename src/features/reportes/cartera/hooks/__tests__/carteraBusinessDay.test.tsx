import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDiaNegocio } from "@/hooks/shared/useDiaNegocio";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { tcDofPorFechaKey } from "@/features/catalogos/hooks/useTcDofPorFecha";
import { useCarteraAging } from "../useCarteraAging";
const m = vi.hoisted(() => ({ cxc: vi.fn(), cxp: vi.fn(), tc: vi.fn() }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: "org-a", loading: false }) }));
vi.mock("@/services/organization", () => ({ getSuperAdminOrg: async () => "org-a" }));
vi.mock("@/features/facturacion/services", () => ({ fetchCobranza: m.cxc, fetchCobranzaKpis: async () => ({}) }));
vi.mock("@/features/cxp/services", () => ({ fetchFacturasCxP: m.cxp }));
vi.mock("@/features/catalogos/services/tipoCambioDof", () => ({ fetchTcDofPorFecha: m.tc }));
const factura = { id: "fp", folio_interno: "FP", proveedor_nombre: "Sintético", embarque_expediente: "E", moneda: "USD", saldo: 100, fecha_emision: "2026-09-01", fecha_vencimiento: "2026-09-12", tipo_cambio_usd: 17 };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const tasa = (fecha: string, usdMxn = 20) => ({ fecha, usdMxn, eurMxn: null, exacto: true });
async function flush() { await act(async () => { for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(2); }); }
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, placeholderData: keepPreviousData } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => { const fecha = useDiaNegocio(); return { fecha, ...useCarteraAging(fecha, "") }; }, { wrapper });
  return { ...hook, client };
}
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] }); vi.setSystemTime(new Date("2026-10-13T05:59:59Z"));
  setAuthSnapshot({ userId: "user-a", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "user-a", organizationId: "org-a" });
  m.cxc.mockResolvedValue([]);
  m.cxp.mockImplementation(async (_filter, fecha) => [{ ...factura, saldo: fecha === "2026-10-12" ? 100 : 60 }]);
  m.tc.mockImplementation(async fecha => tasa(fecha, fecha === "2026-10-12" ? 20 : 21));
});
describe("Cartera: un solo corte CDMX para snapshot, TC y antigüedad", () => {
  it("medianoche cambia 30→31, recupera pago y TC nuevos sin filas provisionales", async () => {
    const { result } = mount(); await flush();
    expect(result.current.fecha).toBe("2026-10-12");
    expect(result.current.cxp.filas[0]).toMatchObject({ diasVencido: 30, saldo: 100, mxnCorte: 2000 });
    const pendiente = deferred<ReturnType<typeof tasa>>(); m.tc.mockReturnValue(pendiente.promise);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); }); await flush();
    expect(result.current.fecha).toBe("2026-10-13");
    expect(result.current.isLoading).toBe(true);
    expect(result.current.dataScope).toBeUndefined();
    expect(result.current.cxp.filas).toEqual([]);
    expect(m.cxp).toHaveBeenLastCalledWith({}, "2026-10-13", expect.objectContaining({ aborted: false }));
    expect(m.tc).toHaveBeenLastCalledWith("2026-10-13");
    await act(async () => pendiente.resolve(tasa("2026-10-13", 21))); await flush();
    expect(result.current.cxp.filas[0]).toMatchObject({ diasVencido: 31, saldo: 60, mxnCorte: 1260 });
    expect(result.current.cxp.filas[0].bucket).toBe("d_31_60");
    expect(result.current.dataScope).toBeDefined();
  });
  it.each(["focus", "visibilitychange"])("revalida tras suspensión usando %s sin esperar al timer", async event => {
    const { result } = mount(); await flush();
    act(() => { vi.setSystemTime(new Date("2026-10-14T12:00:00Z")); (event === "focus" ? window : document).dispatchEvent(new Event(event)); });
    expect(result.current.fecha).toBe("2026-10-14"); expect(result.current.dataScope).toBeUndefined();
    await flush(); expect(m.tc).toHaveBeenLastCalledWith("2026-10-14");
    expect(result.current.cxp.filas[0]).toMatchObject({ diasVencido: 32, saldo: 60 });
  });
  it("la respuesta tardía de ayer no sustituye el pago de hoy", async () => {
    const old = deferred<typeof factura[]>(); m.cxp.mockReturnValueOnce(old.promise);
    const { result } = mount(); await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); }); await flush();
    expect(result.current.cxp.filas[0].saldo).toBe(60);
    await act(async () => old.resolve([factura])); await flush();
    expect(result.current.cxp.filas[0]).toMatchObject({ saldo: 60, diasVencido: 31 });
  });
  it("bloquea una valuación cacheada mientras se refresca su TC", async () => {
    const { result, client } = mount(); await flush();
    const pending = deferred<ReturnType<typeof tasa>>(); m.tc.mockReturnValue(pending.promise);
    act(() => { void client.invalidateQueries({ queryKey: tcDofPorFechaKey("2026-10-12") }); }); await flush();
    expect(result.current.isLoading).toBe(true); expect(result.current.dataScope).toBeUndefined();
    expect(result.current.cxp.filas).toEqual([]);
    await act(async () => pending.resolve(tasa("2026-10-12", 22))); await flush();
    expect(result.current.cxp.total.mxnCorte).toBe(2200);
  });
});
