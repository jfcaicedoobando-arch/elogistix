import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// `vi.mock` se hoistea por encima de los imports, por lo que cualquier
// referencia a variables del módulo debe declararse vía `vi.hoisted`.
const { mockFetchUserContext } = vi.hoisted(() => ({
  mockFetchUserContext: vi.fn(),
}));

vi.mock("@/features/auth/services", () => ({
  fetchUserContext: mockFetchUserContext,
}));

import { createWrapper } from "@/test/utils/queryWrapper";
import { useAuthProfile } from "../useAuthProfile";

beforeEach(() => {
  mockFetchUserContext.mockReset();
});

describe("useAuthProfile", () => {
  it("retorna EMPTY_PROFILE cuando userId es null", () => {
    const { result } = renderHook(() => useAuthProfile(null), { wrapper: createWrapper() });
    expect(result.current.profile.role).toBeNull();
    expect(result.current.profile.organizationId).toBeNull();
  });

  it("carga perfil cuando userId es provisto", async () => {
    mockFetchUserContext.mockResolvedValue({
      role: "admin",
      orgRole: "admin",
      organizationId: "org1",
      organization: { id: "org1", nombre: "Org", rfc: "RFC", logo_url: null, plan: "pro", activo: true },
    });
    const { result } = renderHook(() => useAuthProfile("user-abc"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.profile.role).toBe("admin"), { timeout: 1000 });
    expect(result.current.profile.organizationId).toBe("org1");
  });

  it("reset limpia el contexto cacheado (logout) y vuelve a EMPTY_PROFILE", async () => {
    mockFetchUserContext.mockResolvedValue({
      role: "user",
      orgRole: null,
      organizationId: "x",
      organization: null,
    });
    const { result, rerender } = renderHook(
      ({ uid }: { uid: string | null }) => useAuthProfile(uid),
      { initialProps: { uid: "u2" as string | null }, wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.profile.role).toBe("user"), { timeout: 1000 });
    await act(async () => {
      result.current.reset();
    });
    // Logout: sin userId el hook no consulta y el perfil queda vacío.
    rerender({ uid: null });
    await waitFor(() => expect(result.current.profile.role).toBeNull());
  });

  it("preserva el perfil previo cuando fetchUserContext retorna null", async () => {
    mockFetchUserContext.mockResolvedValueOnce({
      role: "admin",
      orgRole: "admin",
      organizationId: "org1",
      organization: null,
    });
    const { result } = renderHook(() => useAuthProfile("u-1"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.profile.role).toBe("admin"));
    // Un refetch que devuelve null no debe pisar el perfil ya cargado.
    mockFetchUserContext.mockResolvedValueOnce(null);
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(mockFetchUserContext).toHaveBeenCalledTimes(2));
    expect(result.current.profile.role).toBe("admin");
  });

  it("ante error de fetchUserContext no actualiza el perfil (queda vacío)", async () => {
    mockFetchUserContext.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useAuthProfile("user-err"), { wrapper: createWrapper() });
    // v13.309.24: timeout más generoso para blindar contra flake bajo paralelismo pesado.
    await waitFor(() => expect(mockFetchUserContext).toHaveBeenCalled(), { timeout: 3000 });
    // Damos una micro-espera para que cualquier setState post-catch se propague.
    await waitFor(() => expect(result.current.profile.role).toBeNull(), { timeout: 3000 });
    expect(result.current.profile.organizationId).toBeNull();
  });
});

