import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { CobranzaRow, CxpRow } from "@/features/tesoreria/domain";
import { queryKeys } from "@/lib/query";
import { useDashboardEjecutivo } from "../useDashboardEjecutivo";

const state = vi.hoisted(() => ({
  bank: vi.fn(),
  fetch: vi.fn(),
  cobranza: [] as CobranzaRow[],
  cxp: [] as CxpRow[],
}));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: "org-a" }) }));
vi.mock("@/features/profit/hooks/useFuenteEerr", () => ({ useFuenteEerr: () => ({ fuente: "embarques" }) }));
vi.mock("@/hooks/shared/useDiaNegocio", () => ({ useDiaNegocio: () => "2026-10-13" }));
vi.mock("@/features/facturacion/hooks", () => ({
  useCobranza: () => ({ data: state.cobranza, error: null, refetch: vi.fn() }),
}));
vi.mock("@/features/cxp/hooks", () => ({
  useFacturasCxP: () => ({ data: state.cxp, error: null, refetch: vi.fn() }),
}));
vi.mock("@/features/tesoreria/services", () => ({
  fetchSaldosCuentas: state.bank,
  fetchLiquidacionesPendientes: vi.fn(async () => []),
}));
vi.mock("@/features/dashboardEjecutivo/services", async () => ({
  fetchFuentesDashboardEjecutivo: state.fetch,
  construirSnapshotEjecutivo: (await import("../../services/snapshot")).construirSnapshotEjecutivo,
}));

it("recompone el snapshot de pantalla y PDF cuando cambian bancos, CxC o CxP", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const bank = { id: "banco", alias: "Caja", banco: "Banco", moneda: "MXN", saldo: 100 };
  state.bank.mockResolvedValue([bank]);
  const eerr = { totalIngresos: { total: 10 }, utilidad: { total: 2 } };
  state.fetch.mockResolvedValue({
    organizationId: "org-a", periodo: "2026-10", fuente: "embarques",
    eerrPeriodo: eerr, eerrPrev: eerr, eerr12m: [], tipoCambio: { usdMxn: 18 },
    presupuesto: { total_presupuesto_mxn: 0, total_real_mxn: 0, categorias_en_exceso: 0 },
  });
  const { result, rerender, unmount } = renderHook(() => useDashboardEjecutivo("2026-10"), { wrapper });
  try {
    await waitFor(() => expect(result.current.data?.kpis.saldo_bancos_mxn).toBe(100));
    const previous = result.current.data;
    state.bank.mockResolvedValue([{ ...bank, saldo: 250 }]);
    await act(async () => client.invalidateQueries({ queryKey: queryKeys.tesoreria.all }));
    await waitFor(() => expect(result.current.data?.flujo.saldo_inicial_mxn).toBe(250));
    expect(result.current.data?.tesoreria.cuentas[0].saldo).toBe(250);
    expect(result.current.data?.kpis.saldo_bancos_mxn).toBe(250);
    expect(previous?.kpis.saldo_bancos_mxn).toBe(100);

    state.cobranza = [{
      id: "cxc", numero: "F-01", cliente_nombre: "Cliente", saldo: 150, moneda: "MXN",
      fecha_vencimiento: "2026-09-01", estatus_cobranza: "Vencida",
    }];
    state.cxp = [{
      id: "cxp", folio_proveedor: "FP-01", proveedor_nombre: "Proveedor", saldo: 80, moneda: "MXN",
      fecha_vencimiento: "2026-10-17", estatus: "Por pagar",
    }];
    rerender();
    expect(result.current.data?.vencimientos.cobranzaMayor30.total_mxn).toBe(150);
    expect(result.current.data?.vencimientos.cxpProximos7.total_mxn).toBe(80);
    expect(result.current.data?.financialAnalysis).toBe(result.current.financialAnalysis);
    expect(result.current.data?.kpis).toMatchObject({ dso_dias: null, dpo_dias: null, runway_meses: null });
    expect(state.fetch).toHaveBeenCalledTimes(1);
  } finally {
    unmount();
    client.clear();
  }
});
