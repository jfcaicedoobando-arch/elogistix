import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRentabilidadClientes } from "../useRentabilidadClientes";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: "org-sintetica", loading: false }) }));
vi.mock("@/services/organization", () => ({ getSuperAdminOrg: vi.fn().mockResolvedValue("org-sintetica") }));
import { getSuperAdminOrg } from "@/services/organization";
import { fetchReportesResumen } from "@/features/reportes/services";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
beforeEach(() => {
  vi.mocked(getSuperAdminOrg).mockReset().mockResolvedValue("org-sintetica");
  setAuthSnapshot({ userId: "user-sintetico", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "user-sintetico", organizationId: "org-sintetica" });
});

vi.mock("@/features/reportes/services", () => ({
  fetchReportesResumen: vi.fn().mockResolvedValue({
    clientes: [{ id: "1", nombre: "Client A", profit: 500 }],
    kpis: { totalClientes: 1, revenue: 1000, profit: 500, margenProm: 50 },
  }),
}));

describe("useRentabilidadClientes", () => {
  it("fetches profitability data and provides KPIs", async () => {
    const { result } = renderHook(() => useRentabilidadClientes({}), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.clientes).toHaveLength(1);
    expect(result.current.kpis.profit).toBe(500);
  });

  it("descarta filas si el tenant del servidor cambia durante la lectura", async () => {
    vi.mocked(getSuperAdminOrg).mockResolvedValueOnce("org-sintetica").mockResolvedValueOnce("otra-org-sintetica");
    const { result } = renderHook(() => useRentabilidadClientes({}), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isDataReady).toBe(false);
    expect(result.current.clientes).toEqual([]);
  });

  it("no revive una lectura inicial si se cambia de tenant y se vuelve mientras espera org_scope", async () => {
    let finish!: (id: string) => void;
    vi.mocked(getSuperAdminOrg).mockReturnValueOnce(new Promise<string>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useRentabilidadClientes({}), { wrapper: createWrapper() });
    await waitFor(() => expect(getSuperAdminOrg).toHaveBeenCalledOnce());
    act(() => {
      syncActiveOrganizationScope({ userId: "user-sintetico", organizationId: "otra-org-sintetica" });
      syncActiveOrganizationScope({ userId: "user-sintetico", organizationId: "org-sintetica" });
      finish("org-sintetica");
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchReportesResumen).not.toHaveBeenCalled();
    expect(result.current.isDataReady).toBe(false);
  });

  it("returns empty arrays when data is missing", async () => {
    const { fetchReportesResumen } = await import("@/features/reportes/services");
    vi.mocked(fetchReportesResumen).mockResolvedValueOnce({ clientes: [], kpis: null } as any);
    const { result } = renderHook(() => useRentabilidadClientes({}), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.clientes).toEqual([]);
  });
});
