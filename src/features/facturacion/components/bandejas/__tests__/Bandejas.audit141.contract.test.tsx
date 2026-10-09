import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { MemoryRouter } from "react-router";
import { Tabs } from "@/components/ui/tabs";
import { BandejaTabs } from "../BandejaTabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { calcularKPIs } from "@/features/facturacion/services/cobranzaAggregates";
import type { FacturaCobranza } from "@/features/facturacion/services/cobranza";
const state = vi.hoisted(() => ({
  counts: {
    data: undefined as undefined | { vencidas: number; porCobrar: number },
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  rows: [] as FacturaCobranza[],
  kpis: {
    total_mxn: 0,
    total_usd: 0,
    vencido_mxn: 0,
    vencido_usd: 0,
    por_vencer_7d_mxn: 0,
    por_vencer_7d_usd: 0,
    facturas_vencidas: 0,
  },
}));
vi.mock("@/features/facturacion/hooks", () => ({
  useHuecoFacturacion: () => ({ totalEmbarques: 0 }),
}));
vi.mock("@/features/facturacion/hooks/useBandejas", () => ({
  useBandejaConteos: () => state.counts,
}));
vi.mock("@/features/facturacion/hooks/useCobranza", () => ({
  useCobranza: () => ({
    data: state.rows,
    kpis: state.kpis,
    kpisIsError: false,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock(
  "@/features/facturacion/hooks/useDashboardEjecutivoFacturacion",
  () => ({
    useDashboardEjecutivoFacturacion: () => ({
      data: undefined,
      isError: false,
      refetch: vi.fn(),
    }),
  }),
);
vi.mock("@/features/facturacion/hooks/useProformasListas", () => ({
  useProformasListasCount: () => ({ data: 0 }),
}));
vi.mock("@/hooks/shared", () => ({ useIsMobile: () => false }));
import { DashboardEjecutivoFacturacion } from "@/features/facturacion/components/DashboardEjecutivoFacturacion";
import { BandejaPorCobrar } from "@/features/facturacion/components/bandejas/BandejaPorCobrar";
import { BandejaVencidas } from "@/features/facturacion/components/bandejas/BandejaVencidas";
function row(
  id: string,
  status: "Vigente" | "Vencida",
  moneda = "MXN",
): FacturaCobranza {
  return {
    id,
    numero: id,
    cliente_id: "cli",
    cliente_nombre: "Cliente",
    expediente: "EXP",
    saldo: 99,
    total: 99,
    pagado: 0,
    notas_credito_aplicadas: 0,
    moneda,
    estatus_cobranza: status,
    estado_factura: "Emitida",
    tipo_cambio: 1,
    fecha_emision: "2026-10-01",
    fecha_vencimiento: status === "Vencida" ? "2026-10-06" : "2026-10-10",
    dias_vencido: status === "Vencida" ? 2 : -2,
  } as FacturaCobranza;
}
function wrapper(params: Record<string, string> = {}) {
  const Nuqs = withNuqsTestingAdapter({
    hasMemory: true,
    searchParams: params,
  });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <TooltipProvider>
        <Nuqs>{children}</Nuqs>
      </TooltipProvider>
    </MemoryRouter>
  );
}
function Switch() {
  const [overdue, setOverdue] = useState(false);
  return (
    <>
      <button onClick={() => setOverdue(true)}>Cambiar bandeja</button>
      {overdue ? <BandejaVencidas /> : <BandejaPorCobrar />}
    </>
  );
}
function Nav() {
  return (
    <TooltipProvider>
      <Tabs value="vencidas">
        <BandejaTabs activeBandeja="vencidas" onSelect={() => {}} />
      </Tabs>
    </TooltipProvider>
  );
}
describe("AUD141 counter and real table contract", () => {
  it("distinguishes a failed initial count from a legitimate zero and offers retry", () => {
    state.counts = {
      data: { vencidas: 0, porCobrar: 0 },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
    const view = render(<Nav />);
    expect(screen.queryByRole("alert")).toBeNull();
    state.counts = { ...state.counts, data: undefined, isError: true };
    view.rerender(<Nav />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudieron cargar los conteos.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar conteos" }));
    expect(state.counts.refetch).toHaveBeenCalledTimes(1);
  });
  it("labels cached counts after refresh failure and clears the warning on recovery", () => {
    state.counts = {
      data: { vencidas: 5, porCobrar: 2 },
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    };
    const view = render(<Nav />);
    expect(
      screen.getByRole("tab", { name: /^Vencidas\s*5$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Se muestran los últimos disponibles.",
    );
    state.counts = { ...state.counts, isFetching: true };
    view.rerender(<Nav />);
    expect(
      screen.getByRole("button", { name: "Reintentar conteos" }),
    ).toBeDisabled();
    state.counts = {
      ...state.counts,
      isError: false,
      isFetching: false,
      data: { vencidas: 3, porCobrar: 2 },
    };
    view.rerender(<Nav />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("tab", { name: /^Vencidas\s*3$/ }),
    ).toBeInTheDocument();
  });
  it("counts an overdue EUR document without converting it into MXN or USD", () => {
    state.rows = [row("EUR1", "Vencida", "EUR")];
    state.kpis = calcularKPIs(state.rows);
    render(
      <>
        <DashboardEjecutivoFacturacion />
        <BandejaVencidas />
      </>,
      { wrapper: wrapper() },
    );
    expect(screen.getByText("Vencido (1)")).toBeInTheDocument();
    expect(screen.getByText("EUR1")).toBeInTheDocument();
    expect(screen.getByText(/facturas vencidas/)).toHaveTextContent(
      "Mostrando 1 de 1 facturas vencidas",
    );
  });
  it("clamps the page when switching from 22 rows to a two-row bucket", async () => {
    state.rows = [
      ...Array.from({ length: 22 }, (_, i) => row(`P${i}`, "Vigente")),
      ...Array.from({ length: 2 }, (_, i) => row(`V${i}`, "Vencida")),
    ];
    state.kpis = calcularKPIs(state.rows);
    render(<Switch />, { wrapper: wrapper({ page: "1", ps: "20" }) });
    expect(screen.getByText("P20")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cambiar bandeja"));
    await waitFor(() =>
      expect(screen.getByText(/facturas vencidas/)).toHaveTextContent(
        "Mostrando 2 de 2 facturas vencidas",
      ),
    );
    expect(screen.getByText("V0")).toBeInTheDocument();
    expect(screen.getByText("V1")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 1")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Sin cartera vencida — todas las facturas están al día.",
      ),
    ).toBeNull();
  });
  it("omits a sub-cent residue but shows EUR monetary cents in the real table", () => {
    state.rows = [
      { ...row("DUST", "Vencida", "EUR"), saldo: 0.0049 },
      { ...row("CENT", "Vencida", "EUR"), saldo: 0.005 },
    ];
    state.kpis = calcularKPIs(state.rows);
    render(<BandejaVencidas />, { wrapper: wrapper() });
    expect(screen.queryByText("DUST")).toBeNull();
    expect(screen.getByText("CENT")).toBeInTheDocument();
    expect(screen.getByText(/facturas vencidas/)).toHaveTextContent(
      "Mostrando 1 de 1 facturas vencidas",
    );
  });
});
