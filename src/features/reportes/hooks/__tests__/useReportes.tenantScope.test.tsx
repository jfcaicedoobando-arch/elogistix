import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
const mocks = vi.hoisted(() => ({ saveOrg: vi.fn(), pdf: vi.fn(), report: vi.fn(), csv: vi.fn(), serverOrg: 'synthetic-a' }));
vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ user:{id:'synthetic-user'}, role:'super_admin', organizationId:null, organization:null, loading:false }) }));
vi.mock('@/services/organization', () => ({
  listActiveOrganizations: async () => [{id:'synthetic-a',nombre:'Synthetic A'},{id:'synthetic-b',nombre:'Synthetic B'}],
  getSuperAdminOrg: async () => mocks.serverOrg, setSuperAdminOrg: mocks.saveOrg,
}));
vi.mock('@/lib/observability/sentry/user', () => ({ syncSentryActiveOrg: vi.fn() }));
vi.mock('@/lib/observability/logger', () => ({ logger: {warn:vi.fn()} }));
vi.mock('@/features/reportes/services', () => ({ fetchReportesResumen: mocks.report }));
vi.mock('@/generators/rentabilidadPdf', () => ({ generarRentabilidadPdf: mocks.pdf }));
vi.mock('@/generators/exportCsv', () => ({ exportToCsv: mocks.csv }));
vi.mock('@/lib/ui/appFeedback', () => ({ notifyWarning:vi.fn(),notifySuccess:vi.fn(),notifyError:vi.fn() }));
vi.mock('@/hooks/shared', async () => ({ usePdfExport: (await import('@/hooks/shared/usePdfExport')).usePdfExport }));
import { OrganizationProvider, useOrganization } from '@/lib/contexts/OrganizationContext';
import { useReportesPageController } from '@/features/reportes/hooks/useReportesPageController';
import { setAuthSnapshot } from '@/lib/auth/authSnapshot';
import { syncActiveOrganizationScope } from '@/lib/auth/authOperationScope';

describe('Rentabilidad: origen tenant de filas y exportaciones', () => {
  it('bloquea encabezado B/filas A durante cambio pendiente y exporta sólo al recuperar B', async () => {
    localStorage.clear();
    setAuthSnapshot({ userId:'synthetic-user', email:null, organizationId:null, organizationName:null, role:'super_admin', effectiveRole:'super_admin' });
    syncActiveOrganizationScope({ userId:'synthetic-user', organizationId:null });
    mocks.serverOrg = 'synthetic-a';
    let finish!: () => void;
    mocks.saveOrg.mockReturnValue(new Promise<void>((resolve) => { finish = () => { mocks.serverOrg = 'synthetic-b'; resolve(); }; }));
    mocks.report.mockImplementation(async () => ({ clientes:[{cliente_id:mocks.serverOrg === 'synthetic-a' ? 'client-a' : 'client-b',cliente_nombre:mocks.serverOrg === 'synthetic-a' ? 'Client from synthetic A' : 'Client from synthetic B',total_embarques:1,venta_usd:100,costo_usd:50,profit_usd:50,margen:50,embarques_sin_tc:0}],kpis:{totalClientes:1,revenue:100,profit:50,margenProm:50,embarquesSinTc:0} }));
    mocks.pdf.mockResolvedValue(undefined);
    const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
    function Wrapper({children}:{children:ReactNode}) { return <QueryClientProvider client={client}><MemoryRouter><OrganizationProvider>{children}</OrganizationProvider></MemoryRouter></QueryClientProvider>; }
    const {result,unmount} = renderHook(() => ({org:useOrganization(), report:useReportesPageController()}),{wrapper:Wrapper});
    await waitFor(() => {expect(result.current.org.organizationId).toBe('synthetic-a');expect(result.current.report.canExport).toBe(true);});
    act(() => result.current.org.setActiveOrganization('synthetic-b'));
    await waitFor(() => {expect(result.current.org.organizationId).toBe('synthetic-b');expect(result.current.report.canExport).toBe(false);});
    expect(result.current.report.sorted).toEqual([]);
    act(() => { result.current.report.handleExportPdf(); result.current.report.handleExport(); });
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.csv).not.toHaveBeenCalled();
    await act(async () => finish());
    await waitFor(() => expect(result.current.report.canExport).toBe(true));
    act(() => result.current.report.handleExportPdf());
    await waitFor(() => expect(mocks.pdf).toHaveBeenCalledOnce());
    expect(mocks.pdf.mock.calls[0][0]).toMatchObject({ organizacion:{id:'synthetic-b',nombre:'Synthetic B'}, clientes:[{cliente_id:'client-b',cliente_nombre:'Client from synthetic B'}] });
    unmount();
    client.clear();
  });
});
