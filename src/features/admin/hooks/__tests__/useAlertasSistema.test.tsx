import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAlertasPendingCount, useAlertasSistemaList, useAcknowledgeAlerta } from "../useAlertasSistema";
import { createWrapper } from "@/test/utils/queryWrapper";
import * as adminService from "@/features/admin/services";

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ user: { id: "test-user" }, role: "super_admin" })),
}));

vi.mock("@/features/admin/services", () => ({
  fetchAlertasPendingCount: vi.fn().mockResolvedValue(5),
  fetchAlertasSistema: vi.fn().mockResolvedValue([{ id: "1", mensaje: "Error" }]),
  acknowledgeAlerta: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

describe("useAlertasSistema", () => {
  it("fetches pending count for super_admin", async () => {
    const { result } = renderHook(() => useAlertasPendingCount(), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.count).toBe(5));
  });

  it("fetches alert list for super_admin", async () => {
    const { result } = renderHook(() => useAlertasSistemaList(), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("acknowledges an alert", async () => {
    const { result } = renderHook(() => useAcknowledgeAlerta(), { wrapper: createWrapper() });
    
    await result.current.mutateAsync("1");
    
    expect(adminService.acknowledgeAlerta).toHaveBeenCalledWith({ id: "1", userId: "test-user" });
  });
});
