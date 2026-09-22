/**
 * P1 auditoría v13.824.3 — la query de perfil debe habilitarse en la
 * transición real null → userId (sin recarga) y ofrecer reintento al fallar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { silenciarLogEsperado } from "@/test/helpers/silenciarLogEsperado";

const { mockFetchUserContext } = vi.hoisted(() => ({
  mockFetchUserContext: vi.fn(),
}));

vi.mock("@/features/auth/services", () => ({
  fetchUserContext: mockFetchUserContext,
}));

import { createWrapper } from "@/test/utils/queryWrapper";
import { useAuthProfile } from "../useAuthProfile";

const AGENTE = {
  role: "agente_carga",
  orgRole: "agente_carga",
  organizationId: "org-1",
  organization: null,
};

beforeEach(() => {
  mockFetchUserContext.mockReset();
});

describe("useAuthProfile — transición null → userId", () => {
  it("no consulta sin userId y resuelve el rol al aparecer la sesión", async () => {
    mockFetchUserContext.mockResolvedValue(AGENTE);

    const { result, rerender } = renderHook(
      ({ uid }: { uid: string | null }) => useAuthProfile(uid),
      { initialProps: { uid: null as string | null }, wrapper: createWrapper() },
    );

    expect(mockFetchUserContext).not.toHaveBeenCalled();
    expect(result.current.profileLoading).toBe(false);
    expect(result.current.profileError).toBe(false);

    rerender({ uid: "u1" });

    await waitFor(() => expect(mockFetchUserContext).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.profile.role).toBe("agente_carga"));
    expect(result.current.profileLoading).toBe(false);
  });

  it("marca profileError al fallar y permite reintentar con refresh()", async () => {
    const log = silenciarLogEsperado(["error"]);
    try {
      mockFetchUserContext.mockRejectedValue(new Error("network"));

      const { result } = renderHook(() => useAuthProfile("u1"), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.profileError).toBe(true), { timeout: 3000 });
      expect(result.current.profile.role).toBeNull();

      mockFetchUserContext.mockReset();
      mockFetchUserContext.mockResolvedValue(AGENTE);
      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => expect(result.current.profile.role).toBe("agente_carga"), { timeout: 3000 });
      expect(result.current.profileError).toBe(false);
    } finally {
      log.restaurar();
    }
  });
});
