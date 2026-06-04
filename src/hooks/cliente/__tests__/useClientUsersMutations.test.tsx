import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useInviteClientUser, useRevokeClientUser } from "../useClientUsersMutations";
import { createWrapper } from "@/test/utils/queryWrapper";
import * as clientUsersService from "@/services/cliente-usuarios";

vi.mock("@/services/cliente-usuarios", () => ({
  fetchClientUsers: vi.fn(),
  inviteClientUser: vi.fn().mockResolvedValue({ success: true }),
  revokeClientUser: vi.fn().mockResolvedValue({ success: true }),
}));

describe("useClientUsersMutations", () => {
  it("invites a client user", async () => {
    const { result } = renderHook(() => useInviteClientUser("client-1"), { wrapper: createWrapper() });
    
    await result.current.mutateAsync({ email: "test@test.com", clienteId: "client-1", role: "portal_admin" });
    
    expect(clientUsersService.inviteClientUser).toHaveBeenCalled();
  });

  it("revokes a client user", async () => {
    const { result } = renderHook(() => useRevokeClientUser("client-1"), { wrapper: createWrapper() });
    
    await result.current.mutateAsync("user-1");
    
    expect(clientUsersService.revokeClientUser).toHaveBeenCalledWith("user-1");
  });
});
