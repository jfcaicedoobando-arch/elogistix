import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrganizationProvider, useOrganization } from "../OrganizationContext";

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    role: null,
    organizationId: null,
    organization: null,
    loading: false,
  }),
}));
vi.mock("@/features/admin/services/organization", () => ({
  listActiveOrganizations: vi.fn(async () => []),
}));
vi.mock("@/lib/browserStorage", () => ({
  safeLocalStorage: { getItem: vi.fn(() => null), setItem: vi.fn() },
  STORAGE_KEYS: { superAdminActiveOrg: "sa_active_org" },
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <OrganizationProvider>{children}</OrganizationProvider>
  </QueryClientProvider>
);

describe("OrganizationContext", () => {
  it("provee valores por defecto para usuario sin sesión", () => {
    const { result } = renderHook(() => useOrganization(), { wrapper });
    expect(result.current.organizationId).toBeNull();
    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.organizations).toEqual([]);
  });

  it("useOrganization fuera del provider retorna defaults (no lanza)", () => {
    const { result } = renderHook(() => useOrganization(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current.loading).toBe(true);
    expect(typeof result.current.setActiveOrganization).toBe("function");
  });
});
