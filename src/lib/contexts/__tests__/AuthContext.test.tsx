import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { signOutCurrentSession } from "@/lib/auth/signOut";
import { purgeSessionCache } from "@/lib/auth/purgeSessionCache";
import { clearPersistedQueryCache } from "@/lib/browserStorage";
import { registrarActividad } from "@/services/bitacora";
import { AuthProvider, useAuth } from "../AuthContext";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: vi.fn() }));
vi.mock("@/lib/auth/authOperationScope", () => ({ captureAuthOperationScope: () => ({ isCurrent: () => true }) }));
const resetProfile = vi.fn();
const clearLoginAudit = vi.fn();
const clearDrafts = vi.fn();
const clearEmbarqueDrafts = vi.fn();
vi.mock("@/services/bitacora", () => ({ registrarActividad: vi.fn() }));
vi.mock("@/lib/auth/purgeSessionCache", () => ({ purgeSessionCache: vi.fn(), debePurgarPorCambioDeUsuario: () => false }));
vi.mock("@/lib/browserStorage", () => ({ clearPersistedQueryCache: vi.fn() }));
vi.mock("@/lib/auth/clearSessionDrafts", () => ({ clearAllDrafts: () => clearDrafts(), clearAllEmbarqueDrafts: () => clearEmbarqueDrafts() }));
vi.mock("../auth/useAuthSession", () => ({
  useAuthSession: () => ({ user: null, session: null, loading: false, lastEvent: null }),
}));
vi.mock("../auth/useAuthProfile", () => ({
  useAuthProfile: () => ({ profile: { role: null, orgRole: null, organizationId: null, organization: null }, reset: resetProfile }),
}));
vi.mock("../auth/useLoginAudit", () => ({
  useLoginAudit: () => ({ clearLoginAudit }),
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
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(registrarActividad).mockResolvedValue(undefined); });
  it("no borra perfil/cachés ni auditoría local si la sesión sigue autenticada", async () => {
    vi.mocked(signOutCurrentSession).mockRejectedValueOnce(new Error("logout failed"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(result.current.signOut()).rejects.toThrow("logout failed");
    expect(resetProfile).not.toHaveBeenCalled();
    expect(clearLoginAudit).not.toHaveBeenCalled();
    expect(purgeSessionCache).not.toHaveBeenCalled();
    expect(clearPersistedQueryCache).not.toHaveBeenCalled();
    expect(clearDrafts).not.toHaveBeenCalled();
  });
  it("una bitácora pendiente no bloquea la salida", async () => {
    vi.mocked(registrarActividad).mockReturnValueOnce(new Promise(() => {}));
    vi.mocked(signOutCurrentSession).mockResolvedValueOnce({ globalRequestSucceeded: false });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await result.current.signOut();
    expect(clearDrafts).toHaveBeenCalledOnce();
    expect(registrarActividad).toHaveBeenCalledWith(expect.objectContaining({ authScope: expect.objectContaining({ isCurrent: expect.any(Function) }) }));
  });
  it("purga datos privados tras cierre local aunque fallen servidor y bitácora", async () => {
    vi.mocked(registrarActividad).mockRejectedValueOnce(new Error("offline"));
    vi.mocked(signOutCurrentSession).mockResolvedValueOnce({ globalRequestSucceeded: false });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await result.current.signOut();
    expect(resetProfile).toHaveBeenCalledOnce();
    expect(clearLoginAudit).toHaveBeenCalledOnce();
    expect(purgeSessionCache).toHaveBeenCalledOnce();
    expect(clearPersistedQueryCache).toHaveBeenCalledOnce();
    expect(clearDrafts).toHaveBeenCalledOnce();
    expect(clearEmbarqueDrafts).toHaveBeenCalledOnce();
  });
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
