/**
 * Cobertura del wrapper `syncSentryUser` / `syncSentryActiveOrg`.
 *
 * Plan E (13.63.0): blindar el flujo de logout — sin esta prueba un refactor
 * podría romper `Sentry.setUser(null)` y dejar el usuario "pegado" entre
 * sesiones, contaminando eventos posteriores con el ID del usuario anterior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const setUser = vi.fn();
const setTags = vi.fn();
const setTag = vi.fn();
const getCurrentScope = vi.fn(() => ({ setTag }));

vi.mock("@sentry/react", () => ({
  setUser: (...args: unknown[]) => setUser(...args),
  setTags: (...args: unknown[]) => setTags(...args),
  getCurrentScope: () => getCurrentScope(),
}));

beforeEach(() => {
  vi.resetModules();
  setUser.mockClear();
  setTags.mockClear();
  setTag.mockClear();
  getCurrentScope.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function flushImport() {
  // Dos micro-ticks: una para resolver `import("@sentry/react")` y otra
  // para que `.then()` dentro del wrapper ejecute su callback.
  await Promise.resolve();
  await Promise.resolve();
}

describe("syncSentryUser", () => {
  it("propaga el usuario con id, email, organization_id y effective_role", async () => {
    const { syncSentryUser } = await import("../user");
    syncSentryUser({
      userId: "u-123",
      email: "test@librecarga.com",
      organizationId: "org-1",
      effectiveRole: "admin_org",
    });
    await flushImport();
    expect(setUser).toHaveBeenCalledWith({ id: "u-123", email: "test@librecarga.com" });
    expect(setTags).toHaveBeenCalledWith({
      organization_id: "org-1",
      effective_role: "admin_org",
    });
  });

  it("limpia el usuario al pasar userId=null (logout)", async () => {
    const { syncSentryUser } = await import("../user");
    syncSentryUser({
      userId: null,
      email: null,
      organizationId: null,
      effectiveRole: null,
    });
    await flushImport();
    expect(setUser).toHaveBeenCalledWith(null);
    expect(setTags).not.toHaveBeenCalled();
  });

  it("ante llamadas concurrentes aplica sólo la última (latest-wins)", async () => {
    const { syncSentryUser } = await import("../user");
    syncSentryUser({ userId: "u-1", email: "a@x.com", organizationId: "o-1", effectiveRole: "user" });
    syncSentryUser({ userId: "u-2", email: "b@x.com", organizationId: "o-2", effectiveRole: "admin" });
    await flushImport();
    expect(setUser).toHaveBeenCalledTimes(1);
    expect(setUser).toHaveBeenCalledWith({ id: "u-2", email: "b@x.com" });
  });
});

describe("syncSentryActiveOrg", () => {
  it("actualiza el tag `active_organization_id` en el scope global", async () => {
    const { syncSentryActiveOrg } = await import("../user");
    syncSentryActiveOrg("org-42");
    await flushImport();
    expect(setTag).toHaveBeenCalledWith("active_organization_id", "org-42");
  });

  it("normaliza null a 'none' para evitar tags vacíos en Sentry", async () => {
    const { syncSentryActiveOrg } = await import("../user");
    syncSentryActiveOrg(null);
    await flushImport();
    expect(setTag).toHaveBeenCalledWith("active_organization_id", "none");
  });
});
