import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrganizationProvider, useOrganization } from "../OrganizationContext";

const orgs = [
  { id: "org-a", nombre: "Alfa Logistics", rfc: "AAA", logo_url: null, plan: "basic", activo: true },
  { id: "org-b", nombre: "Beta Cargo", rfc: "BBB", logo_url: null, plan: "basic", activo: true },
];

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "sa-1" },
    role: "super_admin",
    organizationId: null,
    organization: null,
    loading: false,
  }),
}));
vi.mock("@/features/admin/services/organization", () => ({
  listActiveOrganizations: vi.fn(async () => orgs),
}));

const getItem = vi.fn<[string], string | null>(() => null);
const setItem = vi.fn();
const removeItem = vi.fn();
vi.mock("@/lib/browserStorage", () => ({
  safeLocalStorage: {
    getItem: (k: string) => getItem(k),
    setItem: (k: string, v: string) => setItem(k, v),
    removeItem: (k: string) => removeItem(k),
  },
  STORAGE_KEYS: { superAdminActiveOrg: "sa_active_org" },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <OrganizationProvider>{children}</OrganizationProvider>
  </QueryClientProvider>
);

describe("OrganizationContext · super admin sin organización", () => {
  beforeEach(() => {
    getItem.mockReset();
    getItem.mockReturnValue(null);
    setItem.mockReset();
    removeItem.mockReset();
  });

  it("no auto-selecciona ninguna organización", async () => {
    const { result } = renderHook(() => useOrganization(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.organizationId).toBeNull();
    expect(result.current.requiereSeleccionOrg).toBe(true);
    expect(result.current.organizations).toHaveLength(2);
  });

  it("respeta la preferencia guardada", async () => {
    getItem.mockReturnValue("org-b");
    const { result } = renderHook(() => useOrganization(), { wrapper });
    await waitFor(() => expect(result.current.organizationId).toBe("org-b"));
    expect(result.current.requiereSeleccionOrg).toBe(false);
  });

  it("salir del tenant limpia la preferencia", async () => {
    getItem.mockReturnValue("org-a");
    const { result } = renderHook(() => useOrganization(), { wrapper });
    await waitFor(() => expect(result.current.organizationId).toBe("org-a"));
    act(() => result.current.clearActiveOrganization());
    await waitFor(() => expect(result.current.organizationId).toBeNull());
    expect(removeItem).toHaveBeenCalledWith("sa_active_org");
  });
});
