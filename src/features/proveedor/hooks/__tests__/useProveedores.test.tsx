import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useProveedoresPaginados, useProveedorMutations } from "../useProveedores";
import { createWrapper } from "@/test/utils/queryWrapper";
import * as proveedorService from "@/features/proveedor/services";

vi.mock("@/features/proveedor/services", () => ({
  fetchProveedoresPaginados: vi.fn().mockResolvedValue({ data: [], count: 0 }),
  insertProveedor: vi.fn().mockResolvedValue({ success: true }),
  updateProveedor: vi.fn().mockResolvedValue({ success: true }),
  deleteProveedor: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/hooks/shared", () => ({
  useOrgFilter: vi.fn(() => ({ organizationId: "org-1" })),
}));

describe("useProveedores", () => {
  it("fetches paginated providers with full filter contract and org scope", async () => {
    const { result } = renderHook(
      () => useProveedoresPaginados({ tipo: "Naviera", search: "ACME", page: 2, pageSize: 25 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(proveedorService.fetchProveedoresPaginados).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "Naviera",
        search: "ACME",
        page: 2,
        pageSize: 25,
        organizationId: "org-1",
      }),
    );
    expect(result.current.data).toEqual({ data: [], count: 0 });
  });

  it("addProveedor pasa el payload tipado completo al servicio", async () => {
    const { result } = renderHook(() => useProveedorMutations(), { wrapper: createWrapper() });
    const payload = {
      nombre: "Naviera Nueva",
      tipo: "Naviera" as const,
      rfc: "NAV010101AAA",
      email: "x@x.mx",
    };

    await result.current.addProveedor(payload as Parameters<typeof result.current.addProveedor>[0]);
    expect(proveedorService.insertProveedor).toHaveBeenCalledTimes(1);
    expect(proveedorService.insertProveedor).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Naviera Nueva", tipo: "Naviera", rfc: "NAV010101AAA" }),
    );
  });
});
