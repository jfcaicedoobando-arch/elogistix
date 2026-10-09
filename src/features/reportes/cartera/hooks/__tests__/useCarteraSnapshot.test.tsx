import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { resetSessionCaches } from "@/lib/auth/sessionCacheRegistry";
import { useCarteraSnapshot } from "../useCarteraSnapshot";

const mocks = vi.hoisted(() => ({ orgId: "org-a", loading: false, serverOrg: "org-a", cxc: vi.fn(), cxp: vi.fn() }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: mocks.orgId, loading: mocks.loading }) }));
vi.mock("@/services/organization", () => ({ getSuperAdminOrg: async () => mocks.serverOrg }));
vi.mock("@/features/facturacion/services", () => ({ fetchCobranza: mocks.cxc, fetchCobranzaKpis: async () => ({}) }));
vi.mock("@/features/cxp/services", () => ({ fetchFacturasCxP: mocks.cxp }));
vi.mock("@/hooks/shared/useDiaNegocio", () => ({ useDiaNegocio: () => "2026-09-30" }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.orgId = "org-a";
  mocks.serverOrg = "org-a";
  mocks.loading = false;
  setAuthSnapshot({ userId: "user-a", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "user-a", organizationId: "org-a" });
  mocks.cxc.mockImplementation(async () => [{ id: `cxc-${mocks.serverOrg}` }]);
  mocks.cxp.mockImplementation(async () => [{ id: `cxp-${mocks.serverOrg}` }]);
});

describe("Cartera: caché aislada y cambio de organización", () => {
  it("oculta A durante la transición y habilita B sólo tras recuperar ambas fuentes en B", async () => {
    const { result, rerender } = renderHook(() => useCarteraSnapshot(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data?.scope.organizationId).toBe("org-a"));
    act(() => {
      mocks.orgId = "org-b";
      syncActiveOrganizationScope({ userId: "user-a", organizationId: "org-b" });
      rerender();
    });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.cxc).toHaveBeenCalledTimes(1);
    act(() => { mocks.serverOrg = "org-b"; void result.current.refetch(); });
    await waitFor(() => expect(result.current.data?.scope.organizationId).toBe("org-b"));
    expect(result.current.data?.cxc).toEqual([{ id: "cxc-org-b" }]);
    expect(result.current.data?.cxp).toEqual([{ id: "cxp-org-b" }]);
  });

  it("no reutiliza la misma caché tras revocar la sesión aunque usuario y tenant coincidan", async () => {
    const { result } = renderHook(() => useCarteraSnapshot(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const firstGeneration = result.current.data?.scope.generation;
    await act(async () => resetSessionCaches());
    await waitFor(() => expect(mocks.cxc).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.data?.scope.generation).toBeGreaterThan(firstGeneration!));
  });

  it("espera la resolución del contexto antes de consultar los saldos", () => {
    mocks.loading = true;
    const { result } = renderHook(() => useCarteraSnapshot(), { wrapper: createWrapper() });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(mocks.cxc).not.toHaveBeenCalled();
  });
});
