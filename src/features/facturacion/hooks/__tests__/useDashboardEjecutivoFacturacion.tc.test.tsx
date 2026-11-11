import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDashboardEjecutivoFacturacion } from "../useDashboardEjecutivoFacturacion";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), rates: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org-prueba" }) }));
vi.mock("@/features/catalogos/hooks/useExchangeRates", () => ({
  useExchangeRates: () => useQuery({ queryKey: ["test-fx"], queryFn: mocks.rates }),
}));

describe("KPIs ejecutivos de Facturación", () => {
  it.each([true, false])("dispara una sola llamada después de resolver el TC (disponible=%s)", async (conTasa) => {
    type Rates = { usdMxn: number };
    let resolveRates!: (value: Rates) => void;
    let rejectRates!: (reason: Error) => void;
    const rates = new Promise<Rates>((resolve, reject) => {
      resolveRates = resolve;
      rejectRates = reject;
    });
    mocks.rates.mockReset().mockReturnValue(rates);
    mocks.rpc.mockReset().mockResolvedValue({
      data: { tendencia: [], facturas_sin_tc: conTasa ? 0 : 3 },
      error: null,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useDashboardEjecutivoFacturacion(), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(mocks.rpc).not.toHaveBeenCalled();

    await act(async () => {
      if (conTasa) resolveRates({ usdMxn: 18 });
      else rejectRates(new Error("TC no disponible"));
    });
    await waitFor(() => expect(result.current.data?.facturas_sin_tc).toBe(conTasa ? 0 : 3));
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("dashboard_facturacion_kpis", {
      p_meses: 6, p_fallback_usd: conTasa ? 18 : undefined,
    });
    unmount();
    client.clear();
  });
});
