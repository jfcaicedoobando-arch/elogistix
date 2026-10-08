/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setAuthSnapshot, getAuthSnapshot } from '@/lib/auth/authSnapshot';
import { syncActiveOrganizationScope } from '@/lib/auth/authOperationScope';
import { queryKeys } from '@/lib/query';
const m = vi.hoisted(() => ({ update: vi.fn(), defaults: vi.fn(), emit: vi.fn(), email: vi.fn(), toast: vi.fn() }));
vi.mock('@/features/facturacion/services', () => ({ actualizarDatosTimbradoFactura: m.update, guardarDefaultsTimbradoCliente: m.defaults }));
vi.mock('@/features/facturacion/services/enviarCfdiEmail', () => ({ enviarCfdiFactura: m.email }));
vi.mock('@/features/facturacion/services/facturapi', () => ({ emitirFacturapi: m.emit, cancelarFacturapi: vi.fn(), FacturapiError: class extends Error {} }));
vi.mock('@/hooks/shared', async () => ({ ...(await import('@/hooks/shared/useMutationWithFeedback')), useToast: () => ({ toast: m.toast }) }));
vi.mock('@/lib/ui/appFeedback', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn(), notifyInfo: vi.fn(), notifyWarning: vi.fn() }));
import { TimbradoContratoError } from '../../services/timbradoWire';
import { notifyError, notifySuccess, notifyInfo, notifyWarning } from '@/lib/ui/appFeedback';
import { useTimbrarFacturaDialog } from '../useTimbrarFacturaDialog';
function switchScope(userId: string, organizationId: string) {
  setAuthSnapshot({ userId, organizationId, email: null, organizationName: null, role: 'admin', effectiveRole: 'admin' });
  syncActiveOrganizationScope({ userId, organizationId });
}
function deferred<T>() { let resolve!: (x: T) => void; let reject!: (e: Error) => void; const promise = new Promise<T>((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; }
const factura = { id: 'invoice-A', numero: 'F-A-123', organization_id: 'org-A', cliente_id: 'client-A', uso_cfdi: 'G01', forma_pago: '03', metodo_pago: 'PUE' };
const cliente = { rfc: 'AAA010101AAA', codigo_postal: '64000', regimen_fiscal: '601', uso_cfdi_default: 'G03' };
const success = { uuid: 'synthetic-only', uso_cfdi_solicitado: 'G01', uso_cfdi_efectivo: 'G01', fuente_uso_cfdi: 'xml' };
const initial = { invoice: factura, open: true, email: 'original@example.test' };
function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const close = vi.fn();
  const hook = renderHook(({ invoice, open, email }) => useTimbrarFacturaDialog(invoice, cliente, null, close, { emailDestino: email, open }), {
    initialProps: initial, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  });
  return { ...hook, qc, close };
}
beforeEach(() => { vi.clearAllMocks(); switchScope('user-A', 'org-A'); m.update.mockResolvedValue(undefined); m.defaults.mockResolvedValue(undefined); m.emit.mockResolvedValue(success); m.email.mockResolvedValue({ enviado_a: 'original@example.test' }); });
describe('explicit confirmation retains its original scope (real React Query, synthetic transport)', () => {
  it.each(['user', 'org', 'role', 'roundtrip', 'unmount', 'invoice', 'reopen', 'email', 'client'])('stops after update when %s changes', async kind => {
    const update = deferred<void>(); m.update.mockReturnValue(update.promise); const h = setup();
    let pending!: Promise<void>; act(() => { pending = h.result.current.onConfirm(); });
    await waitFor(() => expect(m.update).toHaveBeenCalledOnce());
    if (kind === 'user') switchScope('user-B', 'org-A');
    if (kind === 'org') switchScope('user-A', 'org-B');
    if (kind === 'role') setAuthSnapshot({ ...getAuthSnapshot(), effectiveRole: 'operador' });
    if (kind === 'roundtrip') { switchScope('user-B', 'org-B'); switchScope('user-A', 'org-A'); }
    if (kind === 'unmount') h.unmount();
    if (kind === 'invoice') h.rerender({ ...initial, invoice: { ...factura, id: 'invoice-B' } });
    if (kind === 'reopen') { h.rerender({ ...initial, open: false }); h.rerender(initial); }
    if (kind === 'email') h.rerender({ ...initial, email: 'other@example.test' });
    if (kind === 'client') h.rerender({ ...initial, invoice: { ...factura, cliente_id: 'client-B' } });
    h.qc.clear(); await act(async () => { update.resolve(); await pending; });
    expect(m.emit).not.toHaveBeenCalled(); expect(m.defaults).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled(); h.unmount();
  });
  it.each(['success', 'pending', 'failure'])('does not turn an in-flight %s result into stale feedback or follow-on calls', async result => {
    const emit = deferred<unknown>(); m.emit.mockReturnValue(emit.promise); const h = setup();
    await act(() => h.result.current.onConfirm()); await waitFor(() => expect(m.emit).toHaveBeenCalledOnce());
    switchScope('user-B', 'org-A'); h.qc.clear(); const invalidation = vi.spyOn(h.qc, 'invalidateQueries');
    await act(async () => { if (result === 'failure') emit.reject(new Error('synthetic failure')); else emit.resolve(result === 'pending' ? { pendiente: true, message: 'Procesando' } : success); });
    expect(notifyError).not.toHaveBeenCalled(); expect(notifySuccess).not.toHaveBeenCalled(); expect(notifyInfo).not.toHaveBeenCalled();
    expect(invalidation).not.toHaveBeenCalled(); expect(m.defaults).not.toHaveBeenCalled(); expect(m.email).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled(); h.unmount();
  });
  it.each([false, true])('stops an already-started success callback during defaults (unmount=%s)', async unmount => {
    const defaults = deferred<void>(); m.defaults.mockReturnValue(defaults.promise); const h = setup();
    act(() => h.result.current.setEnviarEmail(true)); await act(() => h.result.current.onConfirm());
    await waitFor(() => expect(m.defaults).toHaveBeenCalledOnce());
    if (unmount) h.unmount(); else switchScope('user-B', 'org-A');
    h.qc.clear(); const key = queryKeys.facturacion.clienteFiscal('client-A'); h.qc.setQueryData(key, cliente);
    const invalidation = vi.spyOn(h.qc, 'invalidateQueries');
    await act(async () => { defaults.resolve(); });
    expect(h.qc.getQueryData(key)).toEqual(cliente); expect(invalidation).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled(); h.unmount(); h.qc.clear();
  });
  it.each(['resolve', 'reject'])('suppresses late email %s feedback and close', async outcome => {
    const email = deferred<unknown>(); m.email.mockReturnValue(email.promise); const h = setup();
    act(() => h.result.current.setEnviarEmail(true)); await act(() => h.result.current.onConfirm());
    await waitFor(() => expect(m.email).toHaveBeenCalledWith('invoice-A', 'original@example.test'));
    vi.mocked(notifyError).mockClear(); switchScope('user-B', 'org-B');
    await act(async () => { if (outcome === 'resolve') email.resolve({ enviado_a: 'original@example.test' }); else email.reject(new Error('email failure')); });
    expect(m.toast).not.toHaveBeenCalled(); expect(notifyError).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled(); h.unmount();
  });
  it('preserves confirmed happy flow and immutable scoped variables', async () => {
    const h = setup(); act(() => h.result.current.setEnviarEmail(true)); await act(() => h.result.current.onConfirm());
    await waitFor(() => expect(h.close).toHaveBeenCalledOnce());
    expect(m.emit).toHaveBeenCalledWith('invoice-A'); expect(m.email).toHaveBeenCalledWith('invoice-A', 'original@example.test');
    const scope = m.update.mock.calls[0][3]; expect(scope.organizationId).toBe('org-A'); expect(scope.borrador).toBe(true);
    expect(m.defaults.mock.calls[0][0]).toBe('client-A'); expect(m.defaults.mock.calls[0][2].authScope).toBe(scope.authScope);
    expect(notifySuccess).toHaveBeenCalledOnce(); h.unmount();
  });
  it('preserves pending 202, closes without defaults or email', async () => {
    m.emit.mockResolvedValue({ pendiente: true, message: 'Procesando' }); const h = setup();
    act(() => h.result.current.setEnviarEmail(true)); await act(() => h.result.current.onConfirm());
    await waitFor(() => expect(h.close).toHaveBeenCalledOnce()); expect(m.defaults).not.toHaveBeenCalled(); expect(m.email).not.toHaveBeenCalled();
    expect(notifyInfo).toHaveBeenCalledOnce(); expect(notifySuccess).not.toHaveBeenCalled(); h.unmount();
  });
  it('keeps same-session update errors and permits a deliberate retry', async () => {
    m.update.mockRejectedValueOnce(new Error('update failed')); const h = setup();
    await act(async () => { await expect(h.result.current.onConfirm()).rejects.toThrow('update failed'); });
    expect(m.emit).not.toHaveBeenCalled(); expect(notifyError).toHaveBeenCalledOnce();
    await act(() => h.result.current.onConfirm()); await waitFor(() => expect(h.close).toHaveBeenCalledOnce()); h.unmount();
  });
  it('suppresses a stale update rejection', async () => {
    const update = deferred<void>(); m.update.mockReturnValue(update.promise); const h = setup(); let pending!: Promise<void>;
    act(() => { pending = h.result.current.onConfirm(); }); await waitFor(() => expect(m.update).toHaveBeenCalledOnce());
    switchScope('user-B', 'org-A'); await act(async () => { update.reject(new Error('denied')); await pending; });
    expect(notifyError).not.toHaveBeenCalled(); expect(m.emit).not.toHaveBeenCalled(); h.unmount();
  });
  it('checks scope again when React Query delays starting the emission mutation', async () => {
    const gate = deferred<void>(); const h = setup();
    h.qc.setMutationDefaults(queryKeys.facturacion.emitirFactura, { onMutate: () => gate.promise });
    // Re-render to adopt the defaults in the real MutationObserver.
    h.rerender(initial); await act(() => h.result.current.onConfirm());
    await waitFor(() => expect(h.qc.getMutationCache().find({ mutationKey: queryKeys.facturacion.emitirFactura })?.state.status).toBe('pending'));
    switchScope('user-B', 'org-A'); await act(async () => { gate.resolve(); });
    expect(m.emit).not.toHaveBeenCalled(); expect(notifyError).not.toHaveBeenCalled(); h.unmount();
  });
  it('keeps same-session emission errors and a deliberate retry', async () => {
    m.emit.mockRejectedValueOnce(new Error('synthetic rejection')); const h = setup();
    await act(() => h.result.current.onConfirm()); await waitFor(() => expect(notifyError).toHaveBeenCalledOnce());
    expect(h.close).not.toHaveBeenCalled(); expect(m.defaults).not.toHaveBeenCalled();
    await act(() => h.result.current.onConfirm()); await waitFor(() => expect(h.close).toHaveBeenCalledOnce());
    expect(m.emit).toHaveBeenCalledTimes(2); h.unmount();
  });
  it('keeps defaults best-effort without repeating successful issuance', async () => {
    m.defaults.mockRejectedValueOnce(new Error('preferences failed')); const h = setup();
    act(() => h.result.current.setEnviarEmail(true)); await act(() => h.result.current.onConfirm());
    await waitFor(() => expect(h.close).toHaveBeenCalledOnce()); expect(m.emit).toHaveBeenCalledOnce(); expect(m.email).toHaveBeenCalledOnce(); h.unmount();
  });
  it('does not reuse an old confirmation handler after navigating to another invoice', async () => {
    const h = setup(); const oldConfirm = h.result.current.onConfirm;
    h.rerender({ ...initial, invoice: { ...factura, id: 'invoice-B' } });
    await act(() => oldConfirm()); expect(m.update).not.toHaveBeenCalled(); expect(m.emit).not.toHaveBeenCalled(); h.unmount();
  });
  it('fails closed when the invoice belongs to another active organization', async () => {
    switchScope('user-A', 'org-B'); const h = setup(); await act(() => h.result.current.onConfirm());
    expect(m.update).not.toHaveBeenCalled(); expect(m.emit).not.toHaveBeenCalled(); h.unmount();
  });

  it.each(['close', 'roundtrip', 'unmount'])('reconciles accepted emission for the same auth after %s without continuing the old dialog', async change => {
    const emit = deferred<unknown>(); m.emit.mockReturnValue(emit.promise); const h = setup();
    const key = queryKeys.facturas.detail('invoice-A'); h.qc.setQueryData(key, factura);
    await act(() => h.result.current.onConfirm()); await waitFor(() => expect(m.emit).toHaveBeenCalledOnce());
    if (change === 'close') { h.rerender({ ...initial, open: false }); h.rerender(initial); }
    if (change === 'roundtrip') { h.rerender({ ...initial, invoice: { ...factura, id: 'invoice-B' } }); h.rerender(initial); }
    if (change === 'unmount') h.unmount();
    await act(async () => { emit.resolve(success); });
    expect(h.qc.getQueryState(key)?.isInvalidated).toBe(true);
    expect(notifySuccess).not.toHaveBeenCalled(); expect(m.defaults).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled(); h.unmount(); h.qc.clear();
  });
  it('reconciles same-auth 202 after close while retaining its pending result', async () => {
    const emit = deferred<unknown>(); m.emit.mockReturnValue(emit.promise); const h = setup();
    const key = queryKeys.facturas.detail('invoice-A'); h.qc.setQueryData(key, factura);
    await act(() => h.result.current.onConfirm()); await waitFor(() => expect(m.emit).toHaveBeenCalledOnce());
    h.rerender({ ...initial, open: false }); const pending = { pendiente: true, message: 'Procesando' };
    await act(async () => { emit.resolve(pending); });
    expect(h.qc.getQueryState(key)?.isInvalidated).toBe(true);
    const mutation = h.qc.getMutationCache().find({ mutationKey: queryKeys.facturacion.emitirFactura });
    expect(mutation?.state.status).toBe('success'); expect(mutation?.state.data).toEqual(pending);
    expect(notifyInfo).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: 'Timbrado en proceso · F-A-123', description: expect.stringContaining('No vuelvas a timbrar') }));
    expect(notifyError).not.toHaveBeenCalled(); expect(notifySuccess).not.toHaveBeenCalled();
    expect(m.defaults).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled(); h.unmount(); h.qc.clear();
  });

  it.each([false, true])('preserves an uncertain 2xx warning after close only for original auth (switch=%s)', async switchAuth => {
    const emit = deferred<unknown>(); m.emit.mockReturnValue(emit.promise); const h = setup();
    const key = queryKeys.facturas.detail('invoice-A'); h.qc.setQueryData(key, factura);
    await act(() => h.result.current.onConfirm()); await waitFor(() => expect(m.emit).toHaveBeenCalledOnce());
    h.rerender({ ...initial, open: false }); if (switchAuth) switchScope('user-B', 'org-A');
    await act(async () => { emit.reject(new TimbradoContratoError({}, 'La factura')); });
    expect(notifyError).not.toHaveBeenCalled(); expect(m.defaults).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled();
    expect(h.qc.getQueryState(key)?.isInvalidated).toBe(!switchAuth);
    if (switchAuth) expect(notifyWarning).not.toHaveBeenCalled();
    else expect(notifyWarning).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: 'Timbrado sin confirmar · F-A-123', description: expect.stringContaining('No vuelvas a timbrar') }));
    h.unmount(); h.qc.clear();
  });

});
