import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureAuthDataScope, syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { resetSessionCaches } from "@/lib/auth/sessionCacheRegistry";
import { fetchCarteraSnapshot, isCarteraScopeCurrent } from "../carteraSnapshot";

const mocks = vi.hoisted(() => ({ serverOrg: vi.fn(), cxc: vi.fn(), cxp: vi.fn(), kpis: vi.fn() }));
vi.mock("@/services/organization", () => ({ getSuperAdminOrg: mocks.serverOrg }));
vi.mock("@/features/facturacion/services", () => ({ fetchCobranza: mocks.cxc, fetchCobranzaKpis: mocks.kpis }));
vi.mock("@/features/cxp/services", () => ({ fetchFacturasCxP: mocks.cxp }));

function session(organizationId: string | null = "org-a", userId = "user-a", role = "super_admin") {
  setAuthSnapshot({ userId, email: null, organizationId: null, organizationName: null, role, effectiveRole: role });
  syncActiveOrganizationScope({ userId, organizationId });
}

beforeEach(() => {
  vi.resetAllMocks();
  session();
  mocks.serverOrg.mockResolvedValue("org-a");
  mocks.cxc.mockResolvedValue([{ id: "cxc-a", saldo: 11 }]);
  mocks.cxp.mockResolvedValue([{ id: "cxp-a", saldo: 23 }]);
  mocks.kpis.mockResolvedValue({});
});

describe("Cartera: snapshot de saldos y tenant", () => {
  it("acredita ámbito antes/después y conserva las fuentes y el día de negocio", async () => {
    const scope = captureAuthDataScope();
    const result = await fetchCarteraSnapshot(scope, "2026-09-30");
    expect(result).toEqual({ scope, cxc: [{ id: "cxc-a", saldo: 11 }], cxp: [{ id: "cxp-a", saldo: 23 }] });
    expect(mocks.serverOrg).toHaveBeenCalledTimes(2);
    expect(mocks.cxc).toHaveBeenCalledWith({});
    expect(mocks.cxp).toHaveBeenCalledWith({}, "2026-09-30");
    expect(mocks.kpis).toHaveBeenCalledWith({});
  });

  it("no lee filas de A cuando la selección local B aún no está persistida", async () => {
    session("org-b");
    await expect(fetchCarteraSnapshot(captureAuthDataScope(), "2026-09-30")).rejects.toThrow(/sincronizada/);
    expect(mocks.cxc).not.toHaveBeenCalled();
    expect(mocks.cxp).not.toHaveBeenCalled();
  });

  it("rechaza un cambio de tenant en servidor durante la lectura", async () => {
    mocks.serverOrg.mockResolvedValueOnce("org-a").mockResolvedValueOnce("org-b");
    await expect(fetchCarteraSnapshot(captureAuthDataScope(), "2026-09-30")).rejects.toThrow(/sincronizada/);
  });

  it("descarta lecturas que terminan tras cambiar A → B → A", async () => {
    mocks.cxc.mockImplementationOnce(async () => { session("org-b"); session("org-a"); return []; });
    await expect(fetchCarteraSnapshot(captureAuthDataScope(), "2026-09-30")).rejects.toThrow(/cambió/);
  });

  it("no publica datos parciales si falla la fuente o su gate de KPIs", async () => {
    mocks.kpis.mockRejectedValue(new Error("KPIs fallaron"));
    await expect(fetchCarteraSnapshot(captureAuthDataScope(), "2026-09-30")).rejects.toThrow("KPIs fallaron");
  });

  it("admite sólo el ámbito global autenticado de plataforma", async () => {
    session(null);
    mocks.serverOrg.mockResolvedValue(null);
    const result = await fetchCarteraSnapshot(captureAuthDataScope(), "2026-09-30");
    expect(result.scope.organizationId).toBeNull();
    session(null, "user-a", "admin");
    expect(isCarteraScopeCurrent(captureAuthDataScope())).toBe(false);
  });

  it.each(["usuario", "rol", "sesión"])("revoca un snapshot anterior por cambio de %s", (change) => {
    const scope = captureAuthDataScope();
    if (change === "usuario") session("org-a", "user-b");
    if (change === "rol") session(null, "user-a", "admin");
    if (change === "sesión") resetSessionCaches();
    expect(isCarteraScopeCurrent(scope)).toBe(false);
  });
});
