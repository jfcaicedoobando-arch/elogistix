import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import('@/services/__tests__/_supabaseChainMock');
  return createSupabaseMock();
});
const registrar = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mock.supabase }));
vi.mock('../bitacoraEmbarques', () => ({ registrarBitacoraEmbarque: registrar }));
import { insertarNotaEmbarque, actualizarEtaEmbarque } from '../embarqueDirectMutations';
import { insertEventoEmbarque } from '../eventos';

const e = '11111111-1111-4111-8111-111111111111';
const event = '22222222-2222-4222-8222-222222222222';
const input = { embarqueId: e, tipo: 'Cambio de ETA', descripcion: 'TS Lines confirma llegada a Manzanillo', ubicacion: 'Agente Ningbo', fecha: '2026-09-27T02:50:30Z', usuario: 'coordinador@example.com' };
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

  it('propaga el mismo ID a actualización ETA, evento y sus bitácoras', async () => {
    await actualizarEtaEmbarque(e, '2026-11-20', event);
    await insertEventoEmbarque({ ...input, eventoId: event });
    const call = mock.tableCalls.find(c => c.table === 'eventos_embarque')!;
    expect(call.opArgs[call.ops.indexOf('insert')][0]).toEqual([expect.objectContaining({ id: event, embarque_id: e })]);
    expect(registrar.mock.calls.map(([p]) => p.detalles.eventoId)).toEqual([event, event]);
  });

  it('el alta de evento independiente también genera una referencia exacta', async () => {
    await insertEventoEmbarque(input);
    const call = mock.tableCalls.find(c => c.table === 'eventos_embarque')!;
    const rows = call.opArgs[call.ops.indexOf('insert')][0] as { id: string }[];
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ detalles: expect.objectContaining({ eventoId: rows[0].id }) }));
  });

  it.each(['', 'no-uuid'])('rechaza referencia inválida %s antes de modificar datos', async eventoId => {
    await expect(actualizarEtaEmbarque(e, '2026-11-20', eventoId)).rejects.toThrow();
    await expect(insertEventoEmbarque({ ...input, eventoId })).rejects.toThrow();
    expect(mock.tableCalls).toHaveLength(0);
    expect(registrar).not.toHaveBeenCalled();
  });
});
