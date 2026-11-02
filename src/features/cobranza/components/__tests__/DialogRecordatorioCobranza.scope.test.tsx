import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { confirmado } from '@/features/cobranza/services/__tests__/recordatorioFixtures';
import { createWrapper } from '@/test/utils/queryWrapper';
import { DialogRecordatorioCobranza, type FacturaRecordatorio } from '../DialogRecordatorioCobranza';
import { setAuthSnapshot, syncAuthSessionUser } from '@/lib/auth/authSnapshot';
import { syncActiveOrganizationScope } from '@/lib/auth/authOperationScope';
import { resetSessionCaches } from '@/lib/auth/sessionCacheRegistry';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('@/lib/ui/appFeedback', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

const initial = { userId: 'user-a', email: null, organizationId: 'org-a', organizationName: null,
  role: 'contador', effectiveRole: 'contador' };
const factura: FacturaRecordatorio = {
  factura_id: 'factura-a', numero: 'QA-A', total: 100, saldo: 50, moneda: 'MXN', dias_vencido: 1,
};
const response = { data: { ok: true, version: 2, factura_id: 'factura-a', destinatario: confirmado('confirmado@example.test') }, error: null };
const send = () => screen.getByRole('button', { name: 'Enviar recordatorio' });

beforeEach(() => {
  invoke.mockReset();
  setAuthSnapshot(initial);
  syncActiveOrganizationScope({ userId: 'user-a', organizationId: 'org-a' });
});

describe('revocación del destinatario confirmado por ámbito de sesión', () => {
  it('un cambio de sesión tras pulsar enviar pero antes del transporte cancela la operación', async () => {
    invoke.mockResolvedValueOnce(response).mockReturnValueOnce(new Promise(() => {}));
    const onOpenChange = vi.fn();
    render(<DialogRecordatorioCobranza open factura={factura} onOpenChange={onOpenChange} />, { wrapper: createWrapper() });
    await waitFor(() => expect(send()).toBeEnabled());
    await act(async () => {
      fireEvent.click(send());
      setAuthSnapshot({ ...initial, userId: 'user-b' });
    });
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(invoke.mock.calls.every(([name]) => name === 'cxc-recordatorio-destinatario')).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it.each([
    ['usuario', () => setAuthSnapshot({ ...initial, userId: 'user-b' })],
    ['organización', () => setAuthSnapshot({ ...initial, organizationId: 'org-b' })],
    ['rol revocado', () => setAuthSnapshot({ ...initial, role: 'viewer', effectiveRole: 'viewer' })],
    ['generación', () => resetSessionCaches()],
  ] as const)('cambio de %s invalida el correo mostrado y exige una nueva lectura', async (_name, change) => {
    let finish!: (result: typeof response) => void;
    const pending = new Promise<typeof response>(resolve => { finish = resolve; });
    invoke.mockResolvedValueOnce(response).mockReturnValueOnce(pending);
    render(<DialogRecordatorioCobranza open factura={factura} onOpenChange={vi.fn()} />, { wrapper: createWrapper() });
    await waitFor(() => expect(send()).toBeEnabled());
    await act(async () => change());
    expect(send()).toBeDisabled();
    expect(screen.queryByText('confirmado@example.test', { exact: false })).not.toBeInTheDocument();
    fireEvent.click(send());
    expect(invoke.mock.calls.map(([name]) => name)).toEqual([
      'cxc-recordatorio-destinatario', 'cxc-recordatorio-destinatario',
    ]);
    await act(async () => finish({ data: null, error: new Error('403') } as unknown as typeof response));
    await screen.findByRole('button', { name: 'Reintentar consulta' });
    expect(send()).toBeDisabled();
  });

  it('otra sesión del mismo usuario no reutiliza el destinatario de la sesión anterior', async () => {
    syncAuthSessionUser('user-a', 'synthetic-session-a');
    invoke.mockResolvedValueOnce(response).mockReturnValueOnce(new Promise(() => {}));
    render(<DialogRecordatorioCobranza open factura={factura} onOpenChange={vi.fn()} />, { wrapper: createWrapper() });
    await waitFor(() => expect(send()).toBeEnabled());
    await act(async () => syncAuthSessionUser('user-a', 'synthetic-session-b'));
    expect(send()).toBeDisabled();
    expect(invoke.mock.calls.every(([name]) => name === 'cxc-recordatorio-destinatario')).toBe(true);
  });

  it('el tenant efectivo del super_admin cambia aunque no cambie su organización de perfil', async () => {
    setAuthSnapshot({ ...initial, organizationId: null, role: 'super_admin', effectiveRole: 'super_admin' });
    invoke.mockResolvedValueOnce(response).mockReturnValueOnce(new Promise(() => {}));
    render(<DialogRecordatorioCobranza open factura={factura} onOpenChange={vi.fn()} />, { wrapper: createWrapper() });
    await waitFor(() => expect(send()).toBeEnabled());
    await act(async () => syncActiveOrganizationScope({ userId: 'user-a', organizationId: 'org-b' }));
    expect(send()).toBeDisabled();
    expect(screen.queryByText('confirmado@example.test', { exact: false })).not.toBeInTheDocument();
    expect(invoke.mock.calls.every(([name]) => name === 'cxc-recordatorio-destinatario')).toBe(true);
  });

  it('una lectura tardía de la generación revocada no habilita enviar después del rechazo del ámbito nuevo', async () => {
    let finishOld!: (result: typeof response) => void;
    const pendingOld = new Promise<typeof response>(resolve => { finishOld = resolve; });
    invoke.mockReturnValueOnce(pendingOld).mockResolvedValueOnce({ data: null, error: new Error('403') });
    render(<DialogRecordatorioCobranza open factura={factura} onOpenChange={vi.fn()} />, { wrapper: createWrapper() });
    await act(async () => setAuthSnapshot({ ...initial, organizationId: 'org-b' }));
    await screen.findByRole('button', { name: 'Reintentar consulta' });
    await act(async () => finishOld(response));
    expect(send()).toBeDisabled();
    expect(screen.queryByText('confirmado@example.test', { exact: false })).not.toBeInTheDocument();
    expect(invoke.mock.calls.every(([name]) => name === 'cxc-recordatorio-destinatario')).toBe(true);
  });
});
