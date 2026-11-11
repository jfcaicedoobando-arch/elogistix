import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildEstadoResultados } from "@/features/profit/domain/estadoResultados";
import { construirSnapshotEjecutivo } from "../../services/snapshot";
import { buildFinancialAnalysis } from '../../services/financialAnalysis';
import type { SnapshotEjecutivo } from "../../services/types";
const state = vi.hoisted(() => ({
  loading: false, data: undefined as SnapshotEjecutivo | undefined, pdf: vi.fn(),
}));
vi.mock("@react-pdf/renderer", () => ({ pdf: state.pdf }));
vi.mock("@/pdf/documents/ReporteEjecutivoDocument", () => ({ ReporteEjecutivoDocument: () => null }));
vi.mock('../../hooks/useDashboardEjecutivo', () => ({ useDashboardEjecutivo: () => ({
  data: state.data, isLoading: state.loading, error: state.loading || state.data ? null : new Error('EERR unavailable'),
  isFetching: state.loading, refetch: vi.fn(), financialAnalysisError: null, financialAnalysisLoading: false,
  financialAnalysis: buildFinancialAnalysis({ organizationId: 'mock-org', selectedMonth: '2026-09',
    currentBalanceReference: '2026-10-13', currencyRows: [{ moneda: 'USD' }] }),
}) }));
vi.mock('@/components/shared/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@/components/shared/PageContainer', () => ({ PageContainer: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/shared/skeletons', () => ({ KpiGridSkeleton: () => <p>Loading snapshot</p> }));
vi.mock('@/components/shared/ChartSkeleton', () => ({ ChartSkeleton: () => null }));
vi.mock('@/lib/observability/reportCaughtError', () => ({ reportCaughtError: vi.fn() }));
vi.mock('@/lib/downloadBlob', () => ({ descargarBlob: vi.fn() }));
vi.mock('@/lib/ui/appFeedback', () => ({ notifyError: vi.fn() }));
vi.mock('@/features/profit/hooks/usePeriodoMesUrl', () => ({ usePeriodoMesUrl: () => ({ mesActual: { key: '2026-09' }, mesesDisponibles: [], setMesKey: vi.fn() }) }));
vi.mock('@/features/profit/components/PeriodoMensualToolbar', () => ({ PeriodoMensualToolbar: () => null }));
vi.mock('@/features/profit/components/FuenteEerrToggle', () => ({ FuenteEerrToggle: () => null }));
vi.mock('@/components/empty/ErrorStateInline', () => ({ ErrorStateInline: ({ message }: { message: string }) => <p role="alert">{message}</p> }));
vi.mock('@/features/profit/components/ProfitSubNav', () => ({ ProfitSubNav: () => null }));
vi.mock('@/hooks/shared', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('@/lib/auth/authOperationScope', () => ({ captureAuthOperationScope: () => ({ assertCurrent: vi.fn() }) }));
vi.mock('../../components/BandaKPIs', () => ({ BandaKPIs: () => null }));
vi.mock('../../components/GraficoEERR12m', () => ({ GraficoEERR12m: () => null }));
vi.mock('../../components/ForecastMultiMesChart', () => ({ ForecastMultiMesChart: () => null }));
vi.mock('../../components/SaldosBancosCard', () => ({ SaldosBancosCard: () => null }));
vi.mock('../../components/TopListaCard', () => ({ TopListaCard: () => null }));
vi.mock('../../components/MiniFlujoCard', () => ({ MiniFlujoCard: () => null }));
vi.mock('../../components/AlertasPanel', () => ({ AlertasPanel: () => null }));
import DashboardEjecutivoPage from '../DashboardEjecutivoPage';

describe('independent review · financial diagnostic survives EERR page states', () => {
  it('renders currency, periods and N/D causes alongside an EERR failure', () => {
    state.loading = false; render(<DashboardEjecutivoPage/>);
    expect(screen.getByRole('alert')).toHaveTextContent('EERR unavailable');
    expect(screen.getAllByText('N/D')).toHaveLength(3);
    expect(screen.getByText(/USD · Sin consolidación/)).toBeInTheDocument();
    expect(screen.getByText(/2026-07-01 a 2026-07-31/)).toBeInTheDocument();
  });
  it('does not conceal the independent diagnostic behind snapshot loading', () => {
    state.loading = true; render(<DashboardEjecutivoPage/>);
    expect(screen.getByText('Loading snapshot')).toBeInTheDocument();
    expect(screen.getAllByText('N/D')).toHaveLength(3);
  });
});

it("exporta al PDF el snapshot actualizado y espera a que terminen las lecturas", async () => {
  const periodo = "2026-09";
  const eerr = buildEstadoResultados([], [], []);
  const cuenta = { id: "banco", alias: "Caja", banco: "Banco", moneda: "MXN", saldo: 100 };
  const financialAnalysis = buildFinancialAnalysis({
    organizationId: "mock-org", selectedMonth: periodo, currentBalanceReference: "2026-10-13",
    currencyRows: [cuenta],
  });
  const snapshot = construirSnapshotEjecutivo({
    fuentes: {
      organizationId: "mock-org", periodo, fuente: "embarques", eerrPeriodo: eerr, eerrPrev: eerr, eerr12m: [],
      tipoCambio: { usdMxn: 18, eurMxn: 20 },
      presupuesto: {
        periodo, filas: [], total_presupuesto_mxn: 0, total_real_mxn: 0, variacion_neta_mxn: 0,
        categorias_en_exceso: 0, top_exceso: [], gastos_sin_tc_count: 0, real_truncado: false,
      },
    },
    cuentas: [cuenta], cobranza: [], cxp: [], liquidaciones: [], financialAnalysis, generadoEn: "2026-10-13T18:00:00Z",
  });
  state.data = snapshot;
  state.loading = true;
  state.pdf.mockReturnValue({ toBlob: async () => new Blob() });
  const { rerender } = render(<DashboardEjecutivoPage />);
  expect(screen.getByRole("button", { name: "PDF" })).toBeDisabled();
  state.data = { ...snapshot, kpis: { ...snapshot.kpis, saldo_bancos_mxn: 250 } };
  state.loading = false;
  rerender(<DashboardEjecutivoPage />);
  fireEvent.click(screen.getByRole("button", { name: "PDF" }));
  await waitFor(() => expect(state.pdf).toHaveBeenCalledWith(expect.objectContaining({
    props: { snapshot: state.data },
  })));
});
