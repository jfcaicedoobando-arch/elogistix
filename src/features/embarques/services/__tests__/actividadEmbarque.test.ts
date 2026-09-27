import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActividadRow } from '../../domain/actividadFeed';
import { contarPorCategoria } from '../../domain/actividadFeed';
import { fetchActividadEmbarque } from '../actividadEmbarque';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const embarqueId = '11111111-1111-4111-8111-111111111111';
const eventoId = '22222222-2222-4222-8222-222222222222';
const base: ActividadRow = { id: '', categoria: 'operacion', tipo: 'evento', fecha: '2026-09-27T02:55:00Z', usuario: 'operaciones@forwarder.example', accion: 'Cambio de ETA', titulo: 'ETA actualizada a 2026-11-20', descripcion: null, monto: null, moneda: null, ref_tipo: 'embarque', ref_id: embarqueId, dedupe_key: null, detalles: null };

beforeEach(() => vi.clearAllMocks());
describe('pipeline real del RPC de actividad', () => {
  it('normaliza, ordena y agrupa el evento con sus bitácoras sin perder detalles', async () => {
    const rows = [
      { ...base, id: 'bit-eta', tipo: 'bitacora', fecha: '2026-09-27T02:54:00Z', detalles: { eventoId, etaNueva: '2026-11-20' } },
      { ...base, id: 'bit-tracking', tipo: 'bitacora', detalles: { eventoId, tipo: 'Cambio de ETA', ubicacion: 'Manzanillo' } },
      { ...base, id: `ev-${eventoId}`, descripcion: 'Reprogramación confirmada por la naviera' },
    ];
    rpc.mockResolvedValueOnce({ data: rows, error: null });
    const items = await fetchActividadEmbarque(embarqueId);
    expect(rpc).toHaveBeenCalledWith('actividad_embarque', { p_embarque_id: embarqueId });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(`ev-${eventoId}`);
    expect(items[0].relacionados?.map(r => r.detalles)).toEqual([rows[1].detalles, rows[0].detalles]);
    expect(contarPorCategoria(items)).toEqual({ operacion: 1 });
  });

  it('no agrupa transiciones de cotización con el estado del embarque', async () => {
    rpc.mockResolvedValueOnce({ data: [
      { ...base, id: 'bit-estado', tipo: 'bitacora', accion: 'cambiar_estado', titulo: 'Cambio de estado a Confirmado' },
      { ...base, id: 'bitc-estado', tipo: 'bitacora', categoria: 'comercial', accion: 'cambiar_estado', titulo: 'Cotización: cambiar_estado', ref_tipo: 'cotizacion', ref_id: eventoId, detalles: { estadoNuevo: 'Confirmado' } },
    ], error: null });
    const items = await fetchActividadEmbarque(embarqueId);
    expect(items).toHaveLength(2);
    expect(contarPorCategoria(items)).toEqual({ operacion: 1, comercial: 1 });
  });

  it('propaga el error del RPC y acepta ausencia de actividad', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('RPC no disponible') });
    await expect(fetchActividadEmbarque(embarqueId)).rejects.toThrow('RPC no disponible');
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchActividadEmbarque(embarqueId)).resolves.toEqual([]);
  });
});
