import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTarifasPendientesAprobacion } from "@/features/costeo/hooks/useTarifasPendientesAprobacion";

const mockUseOrganization = vi.fn();
vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: () => mockUseOrganization(),
}));

const mockSelect = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: mockSelect }) },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useTarifasPendientesAprobacion", () => {
  beforeEach(() => {
    mockUseOrganization.mockReturnValue({ organizationId: "org-1" });
    mockSelect.mockReset();
  });

  it("devuelve el conteo cuando hay 5 tarifas en borrador", async () => {
    const eq2 = vi.fn().mockResolvedValue({ count: 5, error: null });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    mockSelect.mockReturnValue({ eq: eq1 });

    const { result } = renderHook(() => useTarifasPendientesAprobacion(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(5);
  });

  it("propaga error de Supabase sin devolver 0", async () => {
    const eq2 = vi.fn().mockResolvedValue({ count: null, error: new Error("boom") });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    mockSelect.mockReturnValue({ eq: eq1 });

    const { result } = renderHook(() => useTarifasPendientesAprobacion(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
