import { beforeEach, describe, expect, it, vi } from "vitest";

function fixtureSdk() {
  return {
    isEnabled: () => true,
    setUser: vi.fn(),
    setTags: vi.fn(),
    setAttributes: vi.fn(),
    setTag: vi.fn(),
    setAttribute: vi.fn(),
  };
}

const usuario = { userId: "u-1", email: "test@librecarga.com", organizationId: "org-1", effectiveRole: "admin_org" };

beforeEach(() => vi.resetModules());

describe("contexto de Sentry", () => {
  it("aplica el último usuario y tenant al iniciar el SDK sin transmitir correo", async () => {
    const { connectSentryScope, syncSentryUser, syncSentryActiveOrg } = await import("../user");
    const sdk = fixtureSdk();
    syncSentryUser({ ...usuario, userId: "anterior" });
    syncSentryUser(usuario);
    syncSentryActiveOrg("org-activa");
    connectSentryScope(sdk);
    expect(sdk.setUser).toHaveBeenCalledExactlyOnceWith({ id: "u-1" });
    const tags = {
      organization_id: "org-1", effective_role: "admin_org",
      active_organization_id: "org-activa", auth_status: "authenticated",
    };
    expect(sdk.setTags).toHaveBeenCalledExactlyOnceWith(tags);
    expect(sdk.setAttributes).toHaveBeenCalledExactlyOnceWith(tags);
  });

  it("limpia el usuario y sus atributos al cerrar sesión", async () => {
    const { connectSentryScope, syncSentryUser, syncSentryActiveOrg } = await import("../user");
    const sdk = fixtureSdk();
    connectSentryScope(sdk);
    syncSentryUser(usuario);
    syncSentryActiveOrg("org-activa");
    syncSentryUser({ userId: null, email: null, organizationId: null, effectiveRole: null });
    expect(sdk.setUser).toHaveBeenLastCalledWith(null);
    const tags = { organization_id: "none", effective_role: "none",
      active_organization_id: "none", auth_status: "anonymous" };
    expect(sdk.setTags).toHaveBeenLastCalledWith(tags);
    expect(sdk.setAttributes).toHaveBeenLastCalledWith(tags);
  });

  it("refleja el cambio de organización después del arranque", async () => {
    const { connectSentryScope, syncSentryActiveOrg } = await import("../user");
    const sdk = fixtureSdk();
    connectSentryScope(sdk);
    syncSentryActiveOrg("org-42");
    syncSentryActiveOrg(null);
    expect(sdk.setTag).toHaveBeenNthCalledWith(1, "active_organization_id", "org-42");
    expect(sdk.setTag).toHaveBeenNthCalledWith(2, "active_organization_id", "none");
    expect(sdk.setAttribute).toHaveBeenLastCalledWith("active_organization_id", "none");
  });
});
