import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAdminDashboardStats, useCreateOrganization } from "../useAdminData";
import { createWrapper } from "@/test/utils/queryWrapper";
import * as adminService from "@/features/admin/services";

vi.mock("@/features/admin/services", () => ({
  fetchAdminDashboardStats: vi.fn().mockResolvedValue({ totalOrgs: 10 }),
  createOrganization: vi.fn().mockResolvedValue({ id: "new-org" }),
}));

describe("useAdminData", () => {
  it("fetches dashboard stats", async () => {
    const { result } = renderHook(() => useAdminDashboardStats(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalOrgs).toBe(10);
  });

  it("creates an organization", async () => {
    const { result } = renderHook(() => useCreateOrganization(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ nombre: "New Org", rfc: "RFC", ownerUserId: "u-1" });
    expect(adminService.createOrganization).toHaveBeenCalled();
  });
});
