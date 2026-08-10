/**
 * Cobertura del wrapper `syncSentryUser` / `syncSentryActiveOrg`.
 *
 * Plan E (13.63.0): blindar el flujo de logout — sin esta prueba un refactor
 * podría romper `Sentry.setUser(null)` y dejar el usuario "pegado" entre
 * sesiones, contaminando eventos posteriores con el ID del usuario anterior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `vi.hoisted` corre ANTES que cualquier import (igual que vi.mock), por lo
// que evita el TDZ sobre los spies cuando el factory del mock se ejecuta.
const sentryMocks = vi.hoisted(() => {
  const setUser = vi.fn();
  const setTags = vi.fn();
  const setTag = vi.fn();
  const getCurrentScope = vi.fn(() => ({ setTag }));
  return { setUser, setTags, setTag, getCurrentScope };
});

vi.mock("@sentry/react", () => ({
  setUser: sentryMocks.setUser,
  setTags: sentryMocks.setTags,
  getCurrentScope: sentryMocks.getCurrentScope,
}));

beforeEach(() => {
  sentryMocks.setUser.mockClear();
  sentryMocks.setTags.mockClear();
  sentryMocks.setTag.mockClear();
  sentryMocks.getCurrentScope.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function flushImport() {
  // Esperar a que microtasks + macrotask drenen (dynamic import + .then chain).
  // El SDK se carga con `import()` dinámico: bajo carga puede tardar más de un
  // macrotask, así que esperamos hasta ver la primera interacción con Sentry.
  const visto = () =>
    sentryMocks.setUser.mock.calls.length > 0 ||
    sentryMocks.getCurrentScope.mock.calls.length > 0;
  for (let i = 0; i < 200 && !visto(); i++) {
    await new Promise<void>((r) => setTimeout(r, 5));
  }
  for (let i = 0; i < 4; i++) await Promise.resolve();
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
    expect(sentryMocks.setUser).toHaveBeenCalledWith({
      id: "u-123",
      email: "test@librecarga.com",
    });
    expect(sentryMocks.setTags).toHaveBeenCalledWith({
      organization_id: "org-1",
      effective_role: "admin_org",
      auth_status: "authenticated",
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
    expect(sentryMocks.setUser).toHaveBeenCalledWith(null);
    expect(sentryMocks.setTags).not.toHaveBeenCalled();
  });

  it("ante llamadas concurrentes el último valor es el que termina aplicado", async () => {
    const { syncSentryUser } = await import("../user");
    syncSentryUser({ userId: "u-1", email: "a@x.com", organizationId: "o-1", effectiveRole: "user" });
    syncSentryUser({ userId: "u-2", email: "b@x.com", organizationId: "o-2", effectiveRole: "admin" });
    await flushImport();
    // Garantía importante: el último setUser refleja el usuario actual.
    // (El SDK puede recibir 1-2 llamadas porque ambos .then se encolan; el
    // contrato del wrapper es "latest-wins sobre el valor", no "1 sola llamada").
    const lastCall = sentryMocks.setUser.mock.calls[sentryMocks.setUser.mock.calls.length - 1];
    expect(lastCall?.[0]).toEqual({ id: "u-2", email: "b@x.com" });
  });
});

describe("syncSentryActiveOrg", () => {
  it("actualiza el tag `active_organization_id` en el scope global", async () => {
    const { syncSentryActiveOrg } = await import("../user");
    syncSentryActiveOrg("org-42");
    await flushImport();
    expect(sentryMocks.setTag).toHaveBeenCalledWith("active_organization_id", "org-42");
  });

  it("normaliza null a 'none' para evitar tags vacíos en Sentry", async () => {
    const { syncSentryActiveOrg } = await import("../user");
    syncSentryActiveOrg(null);
    await flushImport();
    expect(sentryMocks.setTag).toHaveBeenCalledWith("active_organization_id", "none");
  });
});
