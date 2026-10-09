import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import('@/services/__tests__/_supabaseChainMock');
  return createSupabaseMock();
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: mock.supabase }));
const queryMock = vi.hoisted(() => vi.fn((options: { queryKey: unknown; queryFn: () => Promise<unknown>; enabled: boolean }) => ({ data: undefined, options })));
const tiposMock = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-query', () => ({ useQuery: queryMock }));
vi.mock('@/features/catalogos/hooks', () => ({ useTiposContenedor: tiposMock }));
vi.mock('@/lib/contexts/OrganizationContext', () => ({ useOrganization: () => ({ organizationId: 'org-prueba' }) }));
vi.mock('@/lib/query', () => ({ queryKeys: { costeo: { tarifas: { top: (params: unknown) => ['top', params] } } } }));
import { useTopTarifas } from '../../hooks/useTopTarifas';
import { fetchTopTarifas } from '../topTarifas';
import { agruparTiposContenedorComerciales, dedupeTiposContenedor, idsEquivalentesDeTipo, resolverIdCanonicoTipo } from '@/features/catalogos/utils/tiposContenedorCanonico';

const catalogo = () => dedupeTiposContenedor([
  { id: 'gp', code: '20GP', name: "20' GP", activo: true, created_at: '2026-01-01' },
  { id: 'dry', code: '20DRY', name: "20' Dry (Standard)", activo: true, created_at: '2026-01-01' },
  { id: 'st', code: '20ST', name: '20 Estándar', activo: true, created_at: '2026-03-01' },
  { id: 'hc', code: '40HC', name: "40' High Cube", activo: true, created_at: '2026-01-01' },
  { id: 'dv', code: '20DV', name: "20' Dry (Standard)", activo: true, created_at: '2026-02-01' },
]);
beforeEach(() => { queryMock.mockClear(); tiposMock.mockReturnValue({ data: catalogo() }); mock.rpcCalls.length = 0; mock.setRpcResult('get_top_tarifas', { data: [], error: null }); });

async function buscar(tipo: string) {
  await fetchTopTarifas({ puertoOrigenId: 'origen', puertoDestinoId: 'destino', tipoContenedorId: tipo, tipoContenedorIds: idsEquivalentesDeTipo(agruparTiposContenedorComerciales(catalogo()), tipo), organizationId: 'org-prueba', fecha: '2026-10-09' });
  return mock.rpcCalls.map((call) => (call.args as { p_tipo_contenedor_id: string }).p_tipo_contenedor_id);
}

describe('búsqueda comercial conserva GP/Dry sin cambiar selección', () => {
  it.each(['gp', 'dry', 'dv', 'st'])('%s consulta todos los aliases comerciales, sin HC', async (tipo) => {
    expect(await buscar(tipo)).toEqual(['dry', 'dv', 'gp', 'st']);
  });
  it('UUID desconocido conserva búsqueda exacta y un catálogo vacío no inventa IDs', () => {
    expect(idsEquivalentesDeTipo(agruparTiposContenedorComerciales(catalogo()), 'legacy')).toEqual(['legacy']);
    expect(idsEquivalentesDeTipo(agruparTiposContenedorComerciales([]), 'gp')).toEqual(['gp']);
  });
  it('no reincorpora opciones apagadas y no modifica el catálogo visual', () => {
    const visual = catalogo().filter((tipo) => tipo.id !== 'gp');
    const antes = structuredClone(visual);
    const comercial = agruparTiposContenedorComerciales(visual);
    expect(idsEquivalentesDeTipo(comercial, 'dry')).toEqual(['dry', 'dv', 'st']);
    expect(visual).toEqual(antes);
    expect(idsEquivalentesDeTipo(catalogo(), 'gp')).toEqual(['gp']);
  });
  it('mantiene el canónico comercial histórico por fecha y UUID con orden estable', () => {
    const visual = catalogo();
    const comercial = agruparTiposContenedorComerciales(visual);
    expect(resolverIdCanonicoTipo(comercial, 'gp')).toBe('dry');
    expect(resolverIdCanonicoTipo(agruparTiposContenedorComerciales([...visual].reverse()), 'dv')).toBe('dry');
    expect(resolverIdCanonicoTipo(visual, 'gp')).toBe('gp');
  });
});

describe('useTopTarifas integra selección separada y búsqueda comercial', () => {
  it.each(['gp', 'dry', 'dv', 'st'])('el hook consulta equivalentes para %s sin cambiar el dato recibido', async (tipo) => {
    const params = { tipoContenedorId: tipo, puertoOrigenId: 'origen', puertoDestinoId: 'destino', fecha: '2026-10-09' };
    const { result } = renderHook(() => useTopTarifas(params));
    expect(result.current.tipoContenedorIds).toEqual(['dry', 'dv', 'gp', 'st']);
    const options = queryMock.mock.calls[0][0];
    expect(options.queryKey).toEqual(['top', expect.objectContaining({ tipoContenedorId: 'dry' })]);
    await options.queryFn();
    expect(mock.rpcCalls.map((call) => (call.args as { p_tipo_contenedor_id: string }).p_tipo_contenedor_id)).toEqual(['dry', 'dv', 'gp', 'st']);
    expect(params.tipoContenedorId).toBe(tipo);
  });
});
