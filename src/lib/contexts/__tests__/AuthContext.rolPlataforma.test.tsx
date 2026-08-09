import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";

/**
 * M1 (Ola 4) — `super_admin` es un rol de plataforma: si aparece como rol de
 * organización (`organization_members.role`) debe ignorarse y no escalar el
 * `effectiveRole`.
 */
const perfil = { role: "operador", orgRole: "super_admin", organizationId: "org-1", organization: null };

vi.mock("../auth/useAuthSession", () => ({
  useAuthSession: () => ({ user: null, session: null, loading: false, lastEvent: null }),
}));
vi.mock("../auth/useAuthProfile", () => ({
  useAuthProfile: () => ({ profile: perfil, reset: vi.fn() }),
}));
vi.mock("../auth/useLoginAudit", () => ({
  useLoginAudit: () => ({ clearLoginAudit: vi.fn() }),
}));
vi.mock("@/lib/auth/signOut", () => ({ signOutCurrentSession: vi.fn() }));
vi.mock("@/lib/supabase/cast", () => ({ fromDb: (x: unknown) => x }));
vi.mock("@/lib/auth/authSnapshot", () => ({ setAuthSnapshot: vi.fn() }));
vi.mock("@/lib/observability/sentry/user", () => ({ syncSentryUser: vi.fn() }));
vi.mock("@/lib/auth/authSnapshotBuilder", () => ({
  buildAuthSnapshot: vi.fn(() => ({})),
  buildSentryUserContext: vi.fn(() => ({})),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("AuthContext · rol de plataforma no escalable desde la organización", () => {
  it("ignora orgRole='super_admin' y conserva el rol global", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.effectiveRole).toBe("operador");
    expect(result.current.effectiveRole).not.toBe("super_admin");
  });
});
