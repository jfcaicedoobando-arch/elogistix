import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { diaNegocio } from "../../services/mxn";
import { useDireccionKpis } from "../useDireccionKpis";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rates: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/features/facturacion", () => ({ fetchVentaFacturadaEmbarques: vi.fn() }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org-prueba" }) }));
vi.mock("@/features/catalogos/hooks/useExchangeRates", () => ({
  useExchangeRates: () => useQuery({ queryKey: ["test-fx"], queryFn: mocks.rates }),
}));

describe("Dirección con tipo de cambio pendiente", () => {
  it("valúa USD y EUR al resolver el TC sin releer facturas, pagos ni embarques", async () => {
    type Rates = { usdMxn: number; eurMxn: number };
    let resolveRates!: (value: Rates) => void;
    mocks.rates.mockReturnValue(new Promise<Rates>((resolve) => { resolveRates = resolve; }));
    const facturas = ["USD", "EUR"].map((moneda) => ({
      id: moneda, moneda, total: 100, tipo_cambio: null, fecha_emision: diaNegocio(),
      fecha_vencimiento: null, estado: "Emitida", cliente_id: "cliente",
    }));
    mocks.from.mockImplementation((table: string) => {
      const builder = {
        select: () => builder, is: () => builder, in: () => builder,
        order: () => builder, range: () => builder, gte: () => builder,
        eq: () => builder, neq: () => builder, or: () => builder, not: () => builder,
        then: (resolve: (data: unknown) => void) => resolve({
          data: table === "facturas" ? facturas : [],
          error: null,
        }),
      };
      return builder;
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useDireccionKpis(), { wrapper });
    await waitFor(() => expect(result.current.data?.hero.facturado_mes_mxn).toBe(0));
    const fuentes = ["embarques", "embarques", "factura_notas_credito", "facturas", "facturas", "pagos_factura"];
    expect(mocks.from.mock.calls.flat().sort()).toEqual(fuentes);

    await act(async () => resolveRates({ usdMxn: 18, eurMxn: 21 }));
    await waitFor(() => expect(result.current.data?.hero.facturado_mes_mxn).toBe(3900));
    expect(mocks.from.mock.calls.flat().sort()).toEqual(fuentes);
    unmount();
    client.clear();
  });
});
