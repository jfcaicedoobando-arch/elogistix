import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
const db = vi.hoisted(() => ({ from: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: db.from } }));
import { obtenerEmbarqueInterno, olvidarEmbarqueInterno } from "../internoEmbarque";
import { obtenerEmbarqueTarifaInfo } from "../tarifaInfo";
import { setAuthSnapshot, syncAuthSessionUser } from "@/lib/auth/authSnapshot";
import { captureAuthOperationScope, syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { purgeSessionCache } from "@/lib/auth/purgeSessionCache";
import { invalidateSessionCacheEntries } from "@/lib/auth/sessionCacheRegistry";

const context = { userId: "user-a", email: null, organizationId: "org-a", organizationName: null, role: "operador", effectiveRole: "operador" };
const internal = { cerrado_snapshot: { mock: 42 }, tarifa_delta_jsonb: { mock_cost: 99 }, reabierto_motivo: "mock", created_by_email: "mock@example.test" };
type Response = { data: unknown; error: { message: string } | null };
function deferred() {
  let resolve!: (result: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.useRealTimers();
  olvidarEmbarqueInterno();
  setAuthSnapshot(context);
  syncActiveOrganizationScope({ userId: context.userId, organizationId: context.organizationId });
  db.from.mockReset(); db.maybeSingle.mockReset();
  db.from.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle: db.maybeSingle }) }) }));
});
afterEach(() => vi.useRealTimers());

describe("private shipment short-lived cache", () => {
  it("deduplicates concurrent hook/tariff/reconciliation requests in one resolved scope", async () => {
    const pending = deferred(); db.maybeSingle.mockReturnValue(pending.promise);
    const first = obtenerEmbarqueInterno("shipment");
    expect(obtenerEmbarqueInterno("shipment")).toBe(first);
    expect(obtenerEmbarqueInterno("shipment")).toBe(first);
    pending.resolve({ data: internal, error: null });
    expect(await first).toEqual(internal);
    expect(await obtenerEmbarqueInterno("shipment")).toEqual(internal);
    expect(db.from).toHaveBeenCalledOnce();
  });
  it("guards delivery of a resolved cache hit across a synchronous purge", async () => {
    db.maybeSingle.mockResolvedValue({ data: internal, error: null });
    await obtenerEmbarqueInterno("shipment");
    const cached = obtenerEmbarqueInterno("shipment");
    purgeSessionCache(new QueryClient());
    await expect(cached).rejects.toThrow(/cambió/);
  });
  it("expires after 15 seconds and forget forces a fresh read", async () => {
    vi.useFakeTimers(); vi.setSystemTime(1000);
    db.maybeSingle.mockResolvedValue({ data: internal, error: null });
    await obtenerEmbarqueInterno("shipment");
    vi.setSystemTime(15999); await obtenerEmbarqueInterno("shipment");
    expect(db.from).toHaveBeenCalledOnce();
    vi.setSystemTime(16000); await obtenerEmbarqueInterno("shipment");
    olvidarEmbarqueInterno("shipment"); await obtenerEmbarqueInterno("shipment");
    expect(db.from).toHaveBeenCalledTimes(3);
  });
  it("real session purge clears resolved results before QueryClient.clear", async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: internal, error: null }).mockResolvedValue({ data: null, error: null });
    await obtenerEmbarqueInterno("shipment");
    const qc = new QueryClient(); const clear = vi.spyOn(qc, "clear"); purgeSessionCache(qc);
    expect(clear).toHaveBeenCalledOnce();
    expect(await obtenerEmbarqueInterno("shipment")).toBeNull();
    expect(db.from).toHaveBeenCalledTimes(2);
  });
  it.each([
    { userId: "user-b" },
    { organizationId: "org-b" },
    { role: "admin", effectiveRole: "admin" },
  ])("never reuses private results across resolved scope changes %j", async (change) => {
    db.maybeSingle.mockResolvedValueOnce({ data: internal, error: null }).mockResolvedValue({ data: null, error: null });
    await obtenerEmbarqueInterno("shipment");
    setAuthSnapshot({ ...context, ...change });
    expect(await obtenerEmbarqueInterno("shipment")).toBeNull();
    expect(db.from).toHaveBeenCalledTimes(2);
  });
  it.each(["cliente", "agente_carga", null])("fails closed for restricted/unresolved role %s", async (role) => {
    db.maybeSingle.mockResolvedValue({ data: internal, error: null });
    await obtenerEmbarqueInterno("shipment");
    setAuthSnapshot({ ...context, role, effectiveRole: role });
    expect(await obtenerEmbarqueInterno("shipment")).toBeNull();
    expect(db.from).toHaveBeenCalledOnce();
  });
  it.each([{ userId: null }, { organizationId: null }])("fails closed when identity is unresolved %j", async (change) => {
    setAuthSnapshot({ ...context, ...change });
    expect(await obtenerEmbarqueInterno("shipment")).toBeNull();
    expect(db.from).not.toHaveBeenCalled();
  });
  it("does not share pending requests after purge or release their stale data", async () => {
    const old = deferred(); db.maybeSingle.mockReturnValueOnce(old.promise).mockResolvedValue({ data: null, error: null });
    const first = obtenerEmbarqueInterno("shipment"); const rejected = expect(first).rejects.toThrow(/cambió/);
    purgeSessionCache(new QueryClient());
    const second = obtenerEmbarqueInterno("shipment"); expect(second).not.toBe(first);
    old.resolve({ data: internal, error: null });
    await rejected; expect(await second).toBeNull();
  });
  it("does not revive requests after A → B → A", async () => {
    const old = deferred(); db.maybeSingle.mockReturnValueOnce(old.promise);
    const first = obtenerEmbarqueInterno("shipment"); const rejected = expect(first).rejects.toThrow(/cambió/);
    setAuthSnapshot({ ...context, effectiveRole: "cliente" }); setAuthSnapshot(context);
    old.resolve({ data: internal, error: null }); await rejected;
  });
  it("clears scope synchronously on logout and same-user re-login before profile resolves", async () => {
    db.maybeSingle.mockResolvedValue({ data: internal, error: null });
    await obtenerEmbarqueInterno("shipment");
    syncAuthSessionUser(null); syncAuthSessionUser(context.userId);
    expect(await obtenerEmbarqueInterno("shipment")).toBeNull();
    setAuthSnapshot(context); await obtenerEmbarqueInterno("shipment");
    expect(db.from).toHaveBeenCalledTimes(2);
  });
  it("uses active superadmin organization and fails closed when no tenant selected", async () => {
    setAuthSnapshot({ ...context, organizationId: null, role: "super_admin", effectiveRole: "super_admin" });
    syncActiveOrganizationScope({ userId: context.userId, organizationId: null });
    expect(await obtenerEmbarqueInterno("shipment")).toBeNull(); expect(db.from).not.toHaveBeenCalled();
    db.maybeSingle.mockResolvedValueOnce({ data: internal, error: null }).mockResolvedValue({ data: null, error: null });
    syncActiveOrganizationScope({ userId: context.userId, organizationId: "org-a" });
    await obtenerEmbarqueInterno("shipment");
    syncActiveOrganizationScope({ userId: context.userId, organizationId: "org-b" });
    expect(await obtenerEmbarqueInterno("shipment")).toBeNull(); expect(db.from).toHaveBeenCalledTimes(2);
  });
  it("old rejection does not evict the newer fresco promise", async () => {
    const old = deferred(), fresh = deferred();
    db.maybeSingle.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const first = obtenerEmbarqueInterno("shipment"); const rejected = expect(first).rejects.toThrow("old failure");
    const second = obtenerEmbarqueInterno("shipment", { fresco: true });
    old.resolve({ data: null, error: { message: "old failure" } }); await rejected;
    expect(obtenerEmbarqueInterno("shipment")).toBe(second); expect(db.from).toHaveBeenCalledTimes(2);
    fresh.resolve({ data: internal, error: null }); expect(await second).toEqual(internal);
  });
  it("fresco and explicit forget suppress earlier in-flight completions", async () => {
    const old = deferred(); db.maybeSingle.mockReturnValueOnce(old.promise).mockResolvedValue({ data: null, error: null });
    const first = obtenerEmbarqueInterno("shipment"); const rejected = expect(first).rejects.toThrow(/cambió/);
    olvidarEmbarqueInterno("shipment"); await obtenerEmbarqueInterno("shipment", { fresco: true });
    old.resolve({ data: internal, error: null }); await rejected;
  });
  it("does not attach a prior staff delta to a restricted same-org tariff row", async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: internal, error: null }); await obtenerEmbarqueInterno("shipment");
    setAuthSnapshot({ ...context, effectiveRole: "cliente", role: "cliente" });
    db.maybeSingle.mockResolvedValue({ data: { tarifa_decision: "public" }, error: null });
    expect(await obtenerEmbarqueTarifaInfo("shipment")).toMatchObject({ tarifa_decision: "public", tarifa_delta_jsonb: null });
    expect(db.from.mock.calls.map(([table]) => table)).toEqual(["embarques_interno_v", "embarques"]);
  });
  it("does not combine an old public row with a new scope's internal row", async () => {
    const old = deferred(); db.maybeSingle.mockReturnValueOnce(old.promise);
    const result = obtenerEmbarqueTarifaInfo("shipment"); const rejected = expect(result).rejects.toThrow(/cambió/);
    setAuthSnapshot({ ...context, userId: "user-b" });
    old.resolve({ data: { tarifa_decision: "old" }, error: null }); await rejected;
    expect(db.from).toHaveBeenCalledOnce();
  });
  it("mutation invalidation refreshes private data without revoking the authenticated continuation", async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: internal, error: null }); await obtenerEmbarqueInterno("shipment");
    const operation = captureAuthOperationScope(); invalidateSessionCacheEntries(); expect(operation.isCurrent()).toBe(true);
    db.maybeSingle.mockResolvedValueOnce({ data: { tarifa_decision: "new" }, error: null }).mockResolvedValueOnce({ data: { ...internal, tarifa_delta_jsonb: { mock_cost: 12 } }, error: null });
    expect(await obtenerEmbarqueTarifaInfo("shipment")).toMatchObject({ tarifa_decision: "new", tarifa_delta_jsonb: { mock_cost: 12 } });
    expect(db.from).toHaveBeenCalledTimes(3);
  });
});
