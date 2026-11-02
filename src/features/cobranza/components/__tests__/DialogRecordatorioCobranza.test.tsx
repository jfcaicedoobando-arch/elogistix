import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { confirmado } from '@/features/cobranza/services/__tests__/recordatorioFixtures';
import { createWrapper } from '@/test/utils/queryWrapper';
import { DialogRecordatorioCobranza, type FacturaRecordatorio } from '../DialogRecordatorioCobranza';
import { setAuthSnapshot } from '@/lib/auth/authSnapshot';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/lib/ui/appFeedback', () => ({ notifyError: mocks.notifyError, notifySuccess: mocks.notifySuccess }));

const factura: FacturaRecordatorio = {
  factura_id: 'factura-a', numero: 'F-001', total: 100, saldo: 50, moneda: 'MXN', dias_vencido: 2,
};
const consulta = (id = factura.factura_id, email: string | null = 'anterior@example.test') => ({
  data: { ok: true, version: 2, factura_id: id, destinatario: email === null ? null : confirmado(email) }, error: null,
});
const props = () => ({ open: true, factura, onOpenChange: vi.fn() });
const enviar = () => screen.getByRole('button', { name: 'Enviar recordatorio' });

beforeEach(() => {
  vi.clearAllMocks();
  setAuthSnapshot({ userId: 'user-a', email: null, organizationId: 'org-a', organizationName: null,
    role: 'contador', effectiveRole: 'contador' });
});

describe('confirmación del destinatario del recordatorio', () => {
  it('abrir y reintentar sólo consulta; confirma el correo mostrado y conserva la nota', async () => {
    const p = props();
    mocks.invoke.mockResolvedValueOnce(consulta()).mockResolvedValueOnce({
      data: { ok: true, enviado_a: 'anterior@example.test' }, error: null,
    });
    render(<DialogRecordatorioCobranza {...p} />, { wrapper: createWrapper() });
    expect(enviar()).toBeDisabled();
    await screen.findByText('anterior@example.test', { exact: false });
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith('cxc-recordatorio-destinatario', { body: { factura_id: 'factura-a' } });
    fireEvent.change(screen.getByLabelText('Mensaje opcional'), { target: { value: '  Mensaje ficticio  ' } });
    fireEvent.click(enviar());
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('cxc-recordatorio-confirmar', {
      body: { factura_id: 'factura-a', nota: 'Mensaje ficticio', canal: 'email', confirmacion_version: 2, destinatario_confirmado: confirmado('anterior@example.test') },
    }));
    await waitFor(() => expect(p.onOpenChange).toHaveBeenCalledWith(false));
  });

  it('el endpoint no disponible bloquea el envío y permite recuperar sólo la lectura', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error('404') })
      .mockResolvedValueOnce(consulta());
    render(<DialogRecordatorioCobranza {...props()} />, { wrapper: createWrapper() });
    const retry = await screen.findByRole('button', { name: 'Reintentar consulta' });
    expect(enviar()).toBeDisabled();
    fireEvent.click(enviar());
    fireEvent.click(retry);
    await waitFor(() => expect(enviar()).toBeEnabled());
    expect(mocks.invoke.mock.calls.map(([name]) => name)).toEqual([
      'cxc-recordatorio-destinatario', 'cxc-recordatorio-destinatario',
    ]);
  });

  it('sin correo no ofrece enviar; cancelar nunca invoca el envío', async () => {
    const p = props();
    mocks.invoke.mockResolvedValue(consulta('factura-a', null));
    render(<DialogRecordatorioCobranza {...p} />, { wrapper: createWrapper() });
    await screen.findByText(/No hay un correo disponible/);
    expect(enviar()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.invoke.mock.calls.map(([name]) => name)).toEqual(['cxc-recordatorio-destinatario']);
  });

  it('cambiar factura descarta el destinatario anterior aunque su lectura llegue después', async () => {
    let resolveA!: (value: ReturnType<typeof consulta>) => void;
    const pendingA = new Promise<ReturnType<typeof consulta>>(resolve => { resolveA = resolve; });
    mocks.invoke.mockReturnValueOnce(pendingA).mockResolvedValueOnce(consulta('factura-b', 'otro@example.test'));
    const p = props();
    const view = render(<DialogRecordatorioCobranza {...p} />, { wrapper: createWrapper() });
    view.rerender(<DialogRecordatorioCobranza {...p} factura={{ ...factura, factura_id: 'factura-b' }} />);
    await screen.findByText('otro@example.test', { exact: false });
    await act(async () => resolveA(consulta()));
    expect(screen.queryByText('anterior@example.test', { exact: false })).not.toBeInTheDocument();
    mocks.invoke.mockResolvedValueOnce({ data: { ok: true, enviado_a: 'otro@example.test' }, error: null });
    fireEvent.click(enviar());
    await waitFor(() => expect(mocks.invoke).toHaveBeenLastCalledWith('cxc-recordatorio-confirmar', {
      body: { factura_id: 'factura-b', nota: '', canal: 'email', confirmacion_version: 2, destinatario_confirmado: confirmado('otro@example.test') },
    }));
  });

  it('una respuesta de otra factura no habilita el envío y el fallo no cierra el diálogo', async () => {
    const p = props();
    mocks.invoke.mockResolvedValueOnce(consulta('otra-factura'));
    render(<DialogRecordatorioCobranza {...p} />, { wrapper: createWrapper() });
    await screen.findByRole('button', { name: 'Reintentar consulta' });
    expect(enviar()).toBeDisabled();
    expect(p.onOpenChange).not.toHaveBeenCalled();
    expect(mocks.invoke.mock.calls.every(([name]) => name === 'cxc-recordatorio-destinatario')).toBe(true);
  });

  it('al reabrir no permite confirmar el destinatario cacheado mientras lo vuelve a consultar', async () => {
    let resolveFresh!: (value: ReturnType<typeof consulta>) => void;
    const fresh = new Promise<ReturnType<typeof consulta>>(resolve => { resolveFresh = resolve; });
    mocks.invoke.mockResolvedValueOnce(consulta()).mockReturnValueOnce(fresh);
    const p = props();
    const view = render(<DialogRecordatorioCobranza {...p} />, { wrapper: createWrapper() });
    await waitFor(() => expect(enviar()).toBeEnabled());
    view.rerender(<DialogRecordatorioCobranza {...p} open={false} />);
    view.rerender(<DialogRecordatorioCobranza {...p} />);
    expect(enviar()).toBeDisabled();
    expect(screen.queryByText('anterior@example.test', { exact: false })).not.toBeInTheDocument();
    await act(async () => resolveFresh(consulta('factura-a', 'vigente@example.test')));
    await waitFor(() => expect(enviar()).toBeEnabled());
    expect(mocks.invoke.mock.calls.map(([name]) => name)).toEqual([
      'cxc-recordatorio-destinatario', 'cxc-recordatorio-destinatario',
    ]);
  });

  it('cambiar la sesión revoca el destinatario anterior antes de permitir enviar', async () => {
    mocks.invoke.mockResolvedValueOnce(consulta()).mockReturnValueOnce(new Promise(() => {}));
    render(<DialogRecordatorioCobranza {...props()} />, { wrapper: createWrapper() });
    await waitFor(() => expect(enviar()).toBeEnabled());
    await act(async () => setAuthSnapshot({ userId: 'user-b', email: null, organizationId: 'org-b',
      organizationName: null, role: 'contador', effectiveRole: 'contador' }));
    expect(enviar()).toBeDisabled();
    expect(screen.queryByText('anterior@example.test', { exact: false })).not.toBeInTheDocument();
    expect(mocks.invoke.mock.calls.every(([name]) => name === 'cxc-recordatorio-destinatario')).toBe(true);
  });

  it('si el destinatario deja de pertenecer al cliente, el error no se sustituye por otro correo', async () => {
    const p = props();
    mocks.invoke.mockResolvedValueOnce(consulta()).mockResolvedValueOnce({
      data: null, error: new Error('El correo no pertenece a los contactos del cliente'),
    });
    render(<DialogRecordatorioCobranza {...p} />, { wrapper: createWrapper() });
    await waitFor(() => expect(enviar()).toBeEnabled());
    fireEvent.click(enviar());
    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());
    expect(p.onOpenChange).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(mocks.invoke).toHaveBeenLastCalledWith('cxc-recordatorio-confirmar', {
      body: { factura_id: 'factura-a', nota: '', canal: 'email', confirmacion_version: 2, destinatario_confirmado: confirmado('anterior@example.test') },
    });
  });
});
