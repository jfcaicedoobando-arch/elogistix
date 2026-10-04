import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { AuthOperationChangedError, syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";

const { getSession, refreshSession } = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession, refreshSession } } }));
import { descargarCfdiFacturapi, fetchCfdiFacturapi } from "../descargarCfdiFacturapi";

function session(userId = "u1", token = "token-sintetico") {
  return { user: { id: userId }, access_token: token, expires_at: Date.now() / 1000 + 3600 };
}
function auth(userId = "u1") {
  setAuthSnapshot({ userId, email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId, organizationId: "org1" });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const unauthorized = () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
beforeEach(() => {
  auth(); getSession.mockReset(); refreshSession.mockReset();
  getSession.mockResolvedValue({ data: { session: session() } });
  vi.stubEnv("VITE_SUPABASE_URL", "https://configured.example.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("35: aislamiento de la descarga asíncrona", () => {
  it("cambio de usuario entre sesión inicial y refresh previo cancela antes del primerrequest", async () => {
    getSession.mockResolvedValueOnce({ data: { session: session() } });
    getSession.mockResolvedValue({ data: { session: session("u2", "token-otro-usuario") } });
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCfdiFacturapi({ tipo: "xml", notaCreditoId: "nc-original" })).rejects.toBeInstanceOf(AuthOperationChangedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no refresca ni reenvía la NC si cambia el tenant superadmin mientras espera401", async () => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValue(pending.promise); vi.stubGlobal("fetch", fetchMock);
    const result = fetchCfdiFacturapi({ tipo: "xml", notaCreditoId: "nc-original" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org2" });
    pending.resolve(unauthorized());
    await expect(result).rejects.toBeInstanceOf(AuthOperationChangedError);
    expect(refreshSession).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["usuario", "organizacion"])("cancela antes de retry si el refresh cambia %s", async (change) => {
    refreshSession.mockImplementation(async () => {
      const next = session(change === "usuario" ? "u2" : "u1", "rotado");
      getSession.mockResolvedValue({ data: { session: next } });
      if (change === "organizacion") syncActiveOrganizationScope({ userId: "u1", organizationId: "org2" });
      return { data: { session: next }, error: null };
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized()); vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCfdiFacturapi({ tipo: "xml", notaCreditoId: "nc-original" })).rejects.toBeInstanceOf(AuthOperationChangedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["usuario", "organizacion"])("no crea descarga ni callback con blob tardío y cambio de %s", async (change) => {
    const pending = deferred<Blob>(); const blob = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, blob, headers: new Headers() }));
    const create = vi.fn(); const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const original = URL.createObjectURL; URL.createObjectURL = create;
    try {
      const result = descargarCfdiFacturapi({ tipo: "xml", notaCreditoId: "nc-original" });
      await vi.waitFor(() => expect(blob).toHaveBeenCalled());
      if (change === "usuario") { auth("u2"); getSession.mockResolvedValue({ data: { session: session("u2") } }); }
      else syncActiveOrganizationScope({ userId: "u1", organizationId: "org2" });
      pending.resolve(new Blob(["xml-sintetico"]));
      await expect(result).rejects.toBeInstanceOf(AuthOperationChangedError);
      expect(create).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled();
    } finally { URL.createObjectURL = original; click.mockRestore(); }
  });
});
