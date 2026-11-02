import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { confirmado } from '@/features/cobranza/services/__tests__/recordatorioFixtures';
import { createWrapper } from '@/test/utils/queryWrapper';
import { setAuthSnapshot } from '@/lib/auth/authSnapshot';
import { syncActiveOrganizationScope } from '@/lib/auth/authOperationScope';
import { DialogRecordatorioCobranza, type FacturaRecordatorio } from '../DialogRecordatorioCobranza';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('@/lib/ui/appFeedback', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

interface InvokeResult { data: unknown; error: unknown }
function deferred<T>() {
  let finish!: (value: T) => void;
  return { promise: new Promise<T>(resolve => { finish = resolve; }), resolve: (value: T) => finish(value) };
}

const factura: FacturaRecordatorio = {
  factura_id: 'factura-a', numero: 'QA-A', total: 100, saldo: 50, moneda: 'MXN', dias_vencido: 1,
};
const otraFactura = { ...factura, factura_id: 'factura-b', numero: 'QA-B' };
const response = (id: string, email: string, contactoId = 'contacto-a'): InvokeResult => ({
  data: { ok: true, version: 2, factura_id: id, destinatario: confirmado(email, contactoId) }, error: null,
});
const sent = (email: string): InvokeResult => ({ data: { ok: true, enviado_a: email }, error: null });
const conflict = (): InvokeResult => ({
  data: null,
  error: new FunctionsHttpError(new Response(JSON.stringify({ code: 'DESTINATARIO_CAMBIO',
    error: 'El correo del contacto cambió. Vuelve a consultar y revisa el destinatario antes de enviar.',
  }), { status: 409, headers: { 'Content-Type': 'application/json' } })),
});
const send = () => screen.getByRole('button', { name: /^Enviar recordatorio$/ });

beforeEach(() => {
  invoke.mockReset();
  setAuthSnapshot({ userId: 'user-a', email: null, organizationId: 'org-a', organizationName: null,
    role: 'contador', effectiveRole: 'contador' });
  syncActiveOrganizationScope({ userId: 'user-a', organizationId: 'org-a' });
});

describe('revisión explícita y respuestas concurrentes del recordatorio', () => {
  it('un conflicto HTTP bloquea el snapshot viejo y exige revisar y confirmar el nuevo sin envío automático', async () => {
    const onOpenChange = vi.fn();
    invoke.mockResolvedValueOnce(response('factura-a', 'anterior@example.test'))
      .mockResolvedValueOnce(conflict())
      .mockResolvedValueOnce(response('factura-a', 'actual@example.test', 'contacto-b'))
      .mockResolvedValueOnce(sent('actual@example.test'));
    render(<DialogRecordatorioCobranza open factura={factura} onOpenChange={onOpenChange} />,
      { wrapper: createWrapper() });
    await waitFor(() => expect(send()).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Mensaje opcional'), { target: { value: 'Nota conservada' } });
    fireEvent.click(send());
    const review = await screen.findByRole('button', { name: 'Revisar destinatario' });
    expect(send()).toBeDisabled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(invoke.mock.calls.map(([name]) => name)).toEqual([
      'cxc-recordatorio-destinatario', 'cxc-recordatorio-confirmar',
    ]);
    expect(invoke).toHaveBeenLastCalledWith('cxc-recordatorio-confirmar', {
      body: { factura_id: 'factura-a', nota: 'Nota conservada', canal: 'email', confirmacion_version: 2,
        destinatario_confirmado: confirmado('anterior@example.test') },
    });

    fireEvent.click(review);
    await screen.findByText('actual@example.test', { exact: false });
    await waitFor(() => expect(send()).toBeEnabled());
    expect(screen.getByLabelText('Mensaje opcional')).toHaveValue('Nota conservada');
    expect(invoke.mock.calls.map(([name]) => name)).toEqual([
      'cxc-recordatorio-destinatario', 'cxc-recordatorio-confirmar', 'cxc-recordatorio-destinatario',
    ]);
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(send());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(invoke).toHaveBeenLastCalledWith('cxc-recordatorio-confirmar', {
      body: { factura_id: 'factura-a', nota: 'Nota conservada', canal: 'email', confirmacion_version: 2,
        destinatario_confirmado: confirmado('actual@example.test', 'contacto-b') },
    });
    expect(invoke).toHaveBeenCalledTimes(4);
  });

  it('una revisión tardía de A no resetea ni cierra el envío pendiente de B', async () => {
    const reviewA = deferred<InvokeResult>();
    const sendB = deferred<InvokeResult>();
    const onOpenChange = vi.fn();
    invoke.mockResolvedValueOnce(response('factura-a', 'a@example.test'))
      .mockResolvedValueOnce(conflict()).mockReturnValueOnce(reviewA.promise)
      .mockResolvedValueOnce(response('factura-b', 'b@example.test', 'contacto-b'))
      .mockReturnValueOnce(sendB.promise);
    const view = render(<DialogRecordatorioCobranza open factura={factura} onOpenChange={onOpenChange} />,
      { wrapper: createWrapper() });
    await waitFor(() => expect(send()).toBeEnabled());
    fireEvent.click(send());
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar destinatario' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(3));
    view.rerender(<DialogRecordatorioCobranza open factura={otraFactura} onOpenChange={onOpenChange} />);
    await screen.findByText('b@example.test', { exact: false });
    await waitFor(() => expect(send()).toBeEnabled());
    fireEvent.click(send());
    await screen.findByRole('button', { name: 'Enviando…' });
    await act(async () => reviewA.resolve(response('factura-a', 'a-actual@example.test')));
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByText('b@example.test', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('a-actual@example.test', { exact: false })).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(5);
    await act(async () => sendB.resolve(sent('b@example.test')));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('el éxito tardío de A no cierra ni borra la nota de otra apertura en B', async () => {
    const sendA = deferred<InvokeResult>();
    const onOpenChange = vi.fn();
    invoke.mockResolvedValueOnce(response('factura-a', 'a@example.test')).mockReturnValueOnce(sendA.promise)
      .mockResolvedValueOnce(response('factura-b', 'b@example.test', 'contacto-b'));
    const view = render(<DialogRecordatorioCobranza open factura={factura} onOpenChange={onOpenChange} />,
      { wrapper: createWrapper() });
    await waitFor(() => expect(send()).toBeEnabled());
    fireEvent.click(send());
    await screen.findByRole('button', { name: 'Enviando…' });
    view.rerender(<DialogRecordatorioCobranza open={false} factura={otraFactura} onOpenChange={onOpenChange} />);
    view.rerender(<DialogRecordatorioCobranza open factura={otraFactura} onOpenChange={onOpenChange} />);
    await screen.findByText('b@example.test', { exact: false });
    fireEvent.change(screen.getByLabelText('Mensaje opcional'), { target: { value: 'Nota de B' } });
    await act(async () => sendA.resolve(sent('a@example.test')));
    await waitFor(() => expect(send()).toBeEnabled());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje opcional')).toHaveValue('Nota de B');
    expect(screen.getByText('b@example.test', { exact: false })).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(3);
  });
});
