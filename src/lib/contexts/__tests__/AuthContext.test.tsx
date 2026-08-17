import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("../auth/useAuthSession", () => ({
  useAuthSession: () => ({ user: null, session: null, loading: false, lastEvent: null }),
}));
vi.mock("../auth/useAuthProfile", () => ({
  useAuthProfile: () => ({ profile: { role: null, orgRole: null, organizationId: null, organization: null }, reset: vi.fn() }),
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

// AuthProvider usa `useQueryClient` (purga EC-01): necesita QueryClientProvider.
const QueryWrapper = createWrapper();
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryWrapper>
    <AuthProvider>{children}</AuthProvider>
  </QueryWrapper>
);

describe("AuthContext", () => {
  it("provee valores por defecto cuando no hay sesión", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.effectiveRole).toBeNull();
  });

  it("useAuth fuera de AuthProvider retorna contexto vacío (no lanza)", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(typeof result.current.signOut).toBe("function");
  });
});
