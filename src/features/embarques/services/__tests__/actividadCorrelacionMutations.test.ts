import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import('@/services/__tests__/_supabaseChainMock');
  return createSupabaseMock();
});
const registrar = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mock.supabase }));
vi.mock('../bitacoraEmbarques', () => ({ registrarBitacoraEmbarque: registrar }));
import { insertarNotaEmbarque } from '../embarqueDirectMutations';

const e = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.clearAllMocks(); mock.resetResults(); mock.tableCalls.length = 0; mock.setTableResult('embarques', { data: { id: e }, error: null }); });

describe('referencias persistidas sin nueva tabla ni migración', () => {
  it('retorna y registra exactamente el ID insertado de la nota', async () => {
    const id = await insertarNotaEmbarque(e, 'Entrega en Apodaca después de arribo', 'coordinador@example.com');
    const call = mock.tableCalls.find(c => c.table === 'notas_embarque')!;
    expect(call.opArgs[call.ops.indexOf('insert')][0]).toMatchObject({ id, embarque_id: e });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ detalles: { usuario: 'coordinador@example.com', notaId: id } }));
  });

  it('no escribe bitácora de nota cuando falla su INSERT', async () => {
    mock.setTableResult('notas_embarque', { data: null, error: new Error('Insert failed') });
    await expect(insertarNotaEmbarque(e, 'Nota válida', 'coordinador@example.com')).rejects.toThrow('Insert failed');
    expect(registrar).not.toHaveBeenCalled();
  });
});
