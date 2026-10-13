import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrapper } from '@/test/utils/queryWrapper';
import { BandaKPIsEficiencia } from '../BandaKPIsEficiencia';
const state = vi.hoisted(() => ({org: 'mock-a', sourceError: null as Error | null, bank: vi.fn(), snapshot: vi.fn()}));
vi.mock('@/lib/contexts/OrganizationContext', () => ({useOrganization: () => ({organizationId: state.org})}));
vi.mock('@/features/profit/hooks/useFuenteEerr', () => ({useFuenteEerr: () => ({fuente: 'facturas'})}));
vi.mock('@/hooks/shared/useDiaNegocio', () => ({useDiaNegocio: () => '2026-10-13'}));
vi.mock('@/features/facturacion/hooks', () => ({useCobranza: () => ({data: [{moneda: state.org === 'mock-a' ? 'MXN' : 'EUR'}],
  isLoading: false, isFetching: false, error: state.sourceError, refetch: vi.fn()})}));
vi.mock('@/features/cxp/hooks', () => ({useFacturasCxP: () => ({data: [], isLoading: false, isFetching: false, error: null, refetch: vi.fn()})}));
vi.mock('@/features/tesoreria/services', () => ({fetchSaldosCuentas: state.bank}));
vi.mock('@/features/dashboardEjecutivo/services', () => ({fetchDashboardEjecutivo: state.snapshot}));
import { useDashboardEjecutivo } from '../../hooks/useDashboardEjecutivo';
function Harness() {
  const source = useDashboardEjecutivo('2026-09');
  return <BandaKPIsEficiencia analysis={source.financialAnalysis}
    loading={source.financialAnalysisLoading} error={source.financialAnalysisError}/>;
}
beforeEach(() => {
  vi.clearAllMocks(); state.org = 'mock-a'; state.sourceError = null;
  state.bank.mockResolvedValue([{id: 'mock-bank', moneda: 'MXN', saldo: 100}]);
  state.snapshot.mockRejectedValue(new Error('mock EERR unavailable'));
});
describe('financial focus · real hook with mocked source reads', () => {
  it('preserves focus through source failure/recovery and organization loading without retained diagnostics', async () => {
    const {rerender} = render(<Harness/>, {wrapper: createWrapper()});
    await waitFor(() => expect(screen.getByText('Datos necesarios para calcular los indicadores')).toBeInTheDocument());
    const region = screen.getByRole('region', {name: 'Eficiencia financiera por moneda'});
    screen.getByText('Datos necesarios para calcular los indicadores').focus();
    state.sourceError = new Error('mock CxC unavailable'); rerender(<Harness/>);
    expect(screen.getByRole('alert')).toHaveTextContent('mock CxC unavailable');
    expect(region).toHaveFocus(); expect(screen.queryByText(/Mes seleccionado/)).not.toBeInTheDocument();
    state.sourceError = null; rerender(<Harness/>);
    await waitFor(() => expect(screen.getByText('Datos necesarios para calcular los indicadores')).toBeInTheDocument());
    expect(region).toHaveFocus();
    screen.getByText('Datos necesarios para calcular los indicadores').focus();
    let resolveBank: ((rows: {id: string; moneda: string; saldo: number}[]) => void) | undefined;
    state.bank.mockImplementation(() => new Promise(resolve => {resolveBank = resolve;}));
    state.org = 'mock-b'; rerender(<Harness/>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Consultando las fuentes financieras'));
    expect(region).toHaveFocus(); expect(screen.queryByText(/MXN ·/)).not.toBeInTheDocument();
    await waitFor(() => expect(resolveBank).toBeDefined());
    await act(async () => resolveBank!([{id: 'mock-bank-b', moneda: 'EUR', saldo: 200}]));
    await waitFor(() => expect(screen.getByText(/EUR ·/)).toBeInTheDocument());
    expect(region).toHaveFocus(); expect(screen.queryByText(/MXN ·/)).not.toBeInTheDocument();
    expect(screen.getAllByText('N/D')).toHaveLength(3);
  });
});
