import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAvailableUsers, useAddOrgMember } from "../useOrgMembersMutations";
import { createWrapper } from "@/test/utils/queryWrapper";
import * as adminService from "@/services/admin";

vi.mock("@/services/admin", () => ({
  fetchAvailableUsers: vi.fn().mockResolvedValue([{ id: "1", email: "test@test.com" }]),
  addOrgMember: vi.fn().mockResolvedValue({ success: true }),
}));

describe("useOrgMembersMutations", () => {
  it("fetches available users", async () => {
    const { result } = renderHook(() => useAvailableUsers(), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("adds an org member", async () => {
    const { result } = renderHook(() => useAddOrgMember(), { wrapper: createWrapper() });
    
    await result.current.mutateAsync({ orgId: "org-1", userId: "user-1", role: "member" });
    
    expect(adminService.addOrgMember).toHaveBeenCalledWith({ orgId: "org-1", userId: "user-1", role: "member" });
  });
});
