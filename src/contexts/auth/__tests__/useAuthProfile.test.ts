import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockFetchUserContext = vi.fn();

vi.mock("@/services/auth", () => ({
  fetchUserContext: mockFetchUserContext,
}));

import { useAuthProfile } from "../useAuthProfile";

beforeEach(() => vi.clearAllMocks());

describe("useAuthProfile", () => {
  it("retorna EMPTY_PROFILE cuando userId es null", () => {
    const { result } = renderHook(() => useAuthProfile(null));
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
    const { result } = renderHook(() => useAuthProfile("user-abc"));
    await waitFor(() => expect(result.current.profile.role).toBe("admin"), { timeout: 500 });
    expect(result.current.profile.organizationId).toBe("org1");
  });

  it("reset vuelve a EMPTY_PROFILE", async () => {
    mockFetchUserContext.mockResolvedValue({ role: "user", orgRole: null, organizationId: "x", organization: null });
    const { result } = renderHook(() => useAuthProfile("u2"));
    await waitFor(() => expect(result.current.profile.role).toBe("user"), { timeout: 500 });
    result.current.reset();
    await waitFor(() => expect(result.current.profile.role).toBeNull());
  });
});
