import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useProveedoresPaginados, useProveedorMutations } from "../useProveedores";
import { createWrapper } from "@/test/utils/queryWrapper";
import * as proveedorService from "@/services/proveedor";

vi.mock("@/services/proveedor", () => ({
  fetchProveedoresPaginados: vi.fn().mockResolvedValue({ data: [], count: 0 }),
  insertProveedor: vi.fn().mockResolvedValue({ success: true }),
  updateProveedor: vi.fn().mockResolvedValue({ success: true }),
  deleteProveedor: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/hooks/shared", () => ({
  useOrgFilter: vi.fn(() => ({ organizationId: "org-1" })),
}));

describe("useProveedores", () => {
  it("fetches paginated providers", async () => {
    const { result } = renderHook(() => useProveedoresPaginados({ tipo: "Naviera", search: "", page: 1, pageSize: 10 }), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(proveedorService.fetchProveedoresPaginados).toHaveBeenCalled();
  });

  it("provides mutation functions", async () => {
    const { result } = renderHook(() => useProveedorMutations(), { wrapper: createWrapper() });
    
    await result.current.addProveedor({ nombre: "New" } as any);
    expect(proveedorService.insertProveedor).toHaveBeenCalled();
  });
});
