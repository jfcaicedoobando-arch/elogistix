import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePuertos, useAdminPuertos } from "../usePuertos";
import { createWrapper } from "@/test/utils/queryWrapper";
import * as catalogosService from "@/features/catalogos/services";

vi.mock("@/features/catalogos/services", () => ({
  fetchPuertos: vi.fn().mockResolvedValue([{ id: "1", name: "Veracruz", code: "VER" }]),
  insertPuerto: vi.fn().mockResolvedValue({ success: true }),
  setPuertoActivo: vi.fn().mockResolvedValue({ success: true }),
  deletePuerto: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/hooks/shared", async () => ({
  ...(await vi.importActual<typeof import("@/hooks/shared/useMutationWithFeedback")>("@/hooks/shared/useMutationWithFeedback")),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

beforeEach(() => {
  setAuthSnapshot({ userId: "catalog-test", email: null, role: "super_admin", effectiveRole: "super_admin",
    organizationId: "org-test", organizationName: null });
});

describe("usePuertos", () => {
  it("fetches active ports", async () => {
    const { result } = renderHook(() => usePuertos(), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("handles port mutations via useAdminPuertos", async () => {
    const { result } = renderHook(() => useAdminPuertos(), { wrapper: createWrapper() });
    
    await result.current.agregarPuerto.mutateAsync({ name: "New", code: "NEW", country: "MX" });
    expect(catalogosService.insertPuerto).toHaveBeenCalled();
  });
});
