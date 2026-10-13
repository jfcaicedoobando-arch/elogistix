import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { useNavieras, useAdminNavieras } from "../useNavieras";
import { createWrapper } from "@/test/utils/queryWrapper";
import * as catalogosService from "@/features/catalogos/services";

vi.mock("@/features/catalogos/services", () => ({
  fetchNavieras: vi.fn().mockResolvedValue([{ id: "1", name: "Maersk", code: "MAEU" }]),
  insertNaviera: vi.fn().mockResolvedValue({ success: true }),
  setNavieraActivo: vi.fn().mockResolvedValue({ success: true }),
  deleteNaviera: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/hooks/shared", async () => ({
  ...(await vi.importActual<typeof import("@/hooks/shared/useMutationWithFeedback")>("@/hooks/shared/useMutationWithFeedback")),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  setAuthSnapshot({ userId: "catalog-test", email: null, role: "super_admin", effectiveRole: "super_admin",
    organizationId: "org-test", organizationName: null });
});

describe("useNavieras", () => {
  it("fetches active navieras", async () => {
    const { result } = renderHook(() => useNavieras(), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("handles naviera mutations", async () => {
    const { result } = renderHook(() => useAdminNavieras(), { wrapper: createWrapper() });
    
    await result.current.agregarNaviera.mutateAsync({ name: "New", code: "NEW" });
    expect(catalogosService.insertNaviera).toHaveBeenCalled();
  });
});
