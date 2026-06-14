import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAdminOrgKpis } from "../useAdminOrgKpis";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/features/admin/services", () => ({
  countOrgMembers: vi.fn().mockResolvedValue(10),
  countOrgEmbarques: vi.fn().mockResolvedValue(20),
  countOrgClientes: vi.fn().mockResolvedValue(30),
  countOrgCotizaciones: vi.fn().mockResolvedValue(40),
}));

describe("useAdminOrgKpis", () => {
  it("fetches all KPIs for an organization", async () => {
    const { result } = renderHook(() => useAdminOrgKpis("org-1"), { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(result.current.memberCount).toBe(10);
      expect(result.current.embarqueCount).toBe(20);
      expect(result.current.clienteCount).toBe(30);
      expect(result.current.cotizacionCount).toBe(40);
    });
  });

  it("returns zero if no id is provided", () => {
    const { result } = renderHook(() => useAdminOrgKpis(undefined), { wrapper: createWrapper() });
    
    expect(result.current.memberCount).toBe(0);
    expect(result.current.embarqueCount).toBe(0);
  });
});
