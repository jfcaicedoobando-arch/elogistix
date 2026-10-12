import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDialogGenerarProformaController } from '../useDialogGenerarProformaController';

const mocks = vi.hoisted(() => ({ credit: vi.fn(), create: vi.fn(), warning: vi.fn(), pdf: vi.fn() }));
vi.mock('@/features/catalogos/hooks/useTasaIVA', () => ({ useTasaIVA: () => 0.16 }));
vi.mock('../useProformas', () => ({ useCrearProforma: () => ({ mutateAsync: mocks.create }) }));
vi.mock('@/features/cliente/services', () => ({ fetchDiasCreditoCliente: (...args: unknown[]) => mocks.credit(...args) }));
vi.mock('@/features/proformas/services', () => ({ fetchClienteParaPdf: vi.fn().mockResolvedValue(null) }));
vi.mock('../useContenedoresEmbarque', () => ({ useContenedoresEmbarque: () => ({ data: [] }) }));
vi.mock('../useProformaTcRecovery', () => ({ useProformaTcRecovery: () => ({ limpiar: vi.fn() }), esErrorTcRequerido: () => false }));
vi.mock('@/lib/ui/appFeedback', () => ({ notifyError: vi.fn(), notifyWarning: (...args: unknown[]) => mocks.warning(...args) }));
vi.mock('@/generators/proformaPdf', () => ({ generarPdfProforma: (...args: unknown[]) => mocks.pdf(...args) }));

const embarque = { id:'emb-credit',cliente_id:'cli-credit',cliente_nombre:'Mock',expediente:'QA-CREDIT',modo:'Terrestre' } as Parameters<typeof useDialogGenerarProformaController>[1];
const conceptos = [{id:'cv-credit',descripcion:'Mock sale',cantidad:1,precio_unitario:100,moneda:'MXN',tipo_iva:'gravado_16',tasa_iva_aplicada:0.16,aplica_iva:true}] as Parameters<typeof useDialogGenerarProformaController>[2];
let client: QueryClient;
function wrapper({children}:{children: ReactNode}) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => { vi.clearAllMocks(); client = new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}}); mocks.create.mockResolvedValue({id:'pf-credit',numero:'PF-QA'}); mocks.pdf.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); client.clear(); });

describe('proforma credit query readiness', () => {
  it('does not create before a delayed credit query resolves, then preserves 30 days', async () => {
    let resolve!: (days: number) => void;
    mocks.credit.mockImplementation(() => new Promise<number>((done) => {resolve=done;}));
    const {result} = renderHook(() => useDialogGenerarProformaController(true,embarque,conceptos,vi.fn()),{wrapper});
    await waitFor(() => expect(mocks.credit).toHaveBeenCalledTimes(1));
    expect(result.current.diasCredito).toBe('');
    await act(async () => { await result.current.handleConfirmar(); });
    expect(mocks.create).not.toHaveBeenCalled();
    await act(async () => resolve(30));
    await waitFor(() => expect(result.current.diasCredito).toBe('30'));
    await act(async () => { await result.current.handleConfirmar(); });
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({diasCredito:30}));
  });
  it('does not create when the credit query failed', async () => {
    mocks.credit.mockRejectedValue(new Error('Credit read failed'));
    const {result}=renderHook(() => useDialogGenerarProformaController(true,embarque,conceptos,vi.fn()),{wrapper});
    await waitFor(() => expect(client.getQueryCache().getAll()[0]?.state.status).toBe('error'));
    await act(async () => { await result.current.handleConfirmar(); });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('retries only the committed PDF even when the credit query becomes unavailable', async () => {
    mocks.credit.mockResolvedValue(30);
    mocks.pdf.mockRejectedValueOnce(new Error('PDF failed'));
    const {result}=renderHook(() => useDialogGenerarProformaController(true,embarque,conceptos,vi.fn()),{wrapper});
    await waitFor(() => expect(result.current.diasCredito).toBe('30'));
    await act(async () => { await result.current.handleConfirmar(); });
    expect(result.current.creada?.proforma.id).toBe('pf-credit');
    mocks.credit.mockImplementation(() => new Promise(() => {}));
    act(() => { void client.resetQueries(); });
    await waitFor(() => expect(result.current.diasCredito).toBe(''));
    await act(async () => { await result.current.handleConfirmar(); });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.pdf).toHaveBeenCalledTimes(2);
  });
  it.each([0,null])('preserves a successfully loaded %s without treating it as loading', async (days) => {
    mocks.credit.mockResolvedValue(days);
    const {result}=renderHook(() => useDialogGenerarProformaController(true,embarque,conceptos,vi.fn()),{wrapper});
    await waitFor(() => expect(client.getQueryCache().getAll()[0]?.state.status).toBe('success'));
    await act(async () => { await result.current.handleConfirmar(); });
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({diasCredito:days}));
  });
});
