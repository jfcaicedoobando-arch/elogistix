import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ toBlob: vi.fn(), download: vi.fn() }));
vi.mock('@react-pdf/renderer', () => ({ pdf: () => ({ toBlob: mocks.toBlob }) }));
vi.mock('@sentry/react', () => ({ startSpan: (_options: unknown, callback: (span: unknown) => unknown) => callback(undefined) }));
vi.mock('@/lib/downloadBlob', () => ({ descargarBlob: mocks.download }));
vi.mock('@/lib/filenames', () => ({ slugifyOrg: (s: string) => s }));
vi.mock('@/pdf/documents/RentabilidadDocument', () => ({ RentabilidadDocument: () => null }));
import { generarRentabilidadPdf } from '@/generators/rentabilidadPdf';
import { setAuthSnapshot } from '@/lib/auth/authSnapshot';
import { syncActiveOrganizationScope } from '@/lib/auth/authOperationScope';

describe('Rentabilidad: ámbito vigente antes de descargar PDF', () => {
  it.each(['tenant', 'usuario', 'logout'] as const)('cancela la descarga al cambiar %s durante toBlob', async (change) => {
    setAuthSnapshot({ userId:'synthetic-user', email:null, organizationId:null, organizationName:null, role:'super_admin', effectiveRole:'super_admin' });
    syncActiveOrganizationScope({ userId:'synthetic-user', organizationId:'synthetic-a' });
    let finish!: (value: Blob) => void;
    mocks.toBlob.mockReturnValue(new Promise<Blob>((resolve) => { finish = resolve; }));
    const pending = generarRentabilidadPdf({ organizacion:{id:'synthetic-a', nombre:'Synthetic A'}, fechaDesde:'2026-10-01', fechaHasta:'2026-10-31', clientes:[], kpis:{total_venta_usd:0,total_costo_usd:0,total_profit_usd:0,margen_promedio:0} });
    await vi.waitFor(() => expect(mocks.toBlob).toHaveBeenCalledOnce());
    if (change === 'tenant') syncActiveOrganizationScope({ userId:'synthetic-user', organizationId:'synthetic-b' });
    else setAuthSnapshot({ userId: change === 'logout' ? null : 'other-synthetic-user', email: null,
      organizationId: null, organizationName: null, role: change === 'logout' ? null : 'super_admin',
      effectiveRole: change === 'logout' ? null : 'super_admin' });
    finish(new Blob(['synthetic only']));
    await expect(pending).rejects.toThrow('cambió el usuario o la organización');
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
