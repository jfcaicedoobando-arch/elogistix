import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import('@/services/__tests__/_supabaseChainMock');
  return createSupabaseMock();
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: mock.supabase }));
import { fetchTopTarifas } from '../topTarifas';
import { dedupeTiposContenedor, idsEquivalentesDeTipo } from '@/features/catalogos/utils/tiposContenedorCanonico';

const catalogo = () => dedupeTiposContenedor([
  { id: 'gp', code: '20GP', name: "20' GP", activo: true, created_at: '2026-01-01' },
  { id: 'dry', code: '20DRY', name: "20' Dry (Standard)", activo: true, created_at: '2026-01-01' },
  { id: 'dv', code: '20DV', name: "20' Dry (Standard)", activo: true, created_at: '2026-02-01' },
]);
beforeEach(() => { mock.rpcCalls.length = 0; mock.setRpcResult('get_top_tarifas', { data: [], error: null }); });

async function buscar(tipo: string) {
  await fetchTopTarifas({ puertoOrigenId: 'origen', puertoDestinoId: 'destino', tipoContenedorId: tipo, tipoContenedorIds: idsEquivalentesDeTipo(catalogo(), tipo), organizationId: 'org-prueba', fecha: '2026-10-09' });
  return mock.rpcCalls.map((call) => (call.args as { p_tipo_contenedor_id: string }).p_tipo_contenedor_id);
}

describe('búsqueda de tarifa respeta variantes GP/Dry', () => {
  it('GP envía únicamente su ID exacto al RPC, sin DRY ni DV', async () => {
    expect(await buscar('gp')).toEqual(['gp']);
  });
  it('Dry conserva búsqueda en ambos IDs legacy, sin incorporar GP', async () => {
    expect(await buscar('dry')).toEqual(['dry', 'dv']);
  });
});
