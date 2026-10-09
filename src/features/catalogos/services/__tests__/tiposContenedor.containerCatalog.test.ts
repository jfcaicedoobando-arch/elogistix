import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import('@/services/__tests__/_supabaseChainMock');
  return createSupabaseMock();
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: mock.supabase }));
vi.mock('@/lib/ui/appFeedback', () => ({ notifyWarning: vi.fn() }));
import { fetchTiposContenedor } from '../tiposContenedor';

const tipo = (id: string, code: string, name: string, activo = true) => ({ id, code, name, activo, created_at: '2026-01-01' });
const rows = [tipo('gp', '20GP', "20' GP"), tipo('dry', '20DRY', "20' Dry (Standard)"), tipo('dv', '20DV', "20' Dry (Standard)"), tipo('hc', '40HC', "40' High Cube")];
beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; });

describe('tipos de contenedor: conserva visibilidad por empresa', () => {
  it('solicita sólo activos globales y elimina apagados antes del dedupe', async () => {
    mock.setTableResult('tipos_contenedor', { data: rows, error: null });
    mock.setTableResult('catalogo_org_desactivado', { data: [{ item_id: 'dry' }], error: null });
    const result = await fetchTiposContenedor();
    const call = mock.tableCalls.find((c) => c.table === 'tipos_contenedor')!;
    expect(call.opArgs[call.ops.indexOf('eq')]).toEqual(['activo', true]);
    expect(result.map((t) => t.code)).toEqual(['20DV', '20GP', '40HC']);
    expect(result.flatMap((t) => t.idsEquivalentes)).not.toContain('dry');
  });

  it('un GP apagado no es reintroducido como equivalente Dry', async () => {
    mock.setTableResult('tipos_contenedor', { data: rows, error: null });
    mock.setTableResult('catalogo_org_desactivado', { data: [{ item_id: 'gp' }], error: null });
    const result = await fetchTiposContenedor();
    expect(result.flatMap((t) => t.idsEquivalentes)).not.toContain('gp');
    expect(result.find((t) => t.code === '20DRY')?.idsEquivalentes).toEqual(['dry', 'dv']);
  });

  it('administración conserva todas las filas y estados global/org', async () => {
    mock.setTableResult('tipos_contenedor', { data: [...rows, tipo('inactive', '45HC', "45' High Cube", false)], error: null });
    mock.setTableResult('catalogo_org_desactivado', { data: [{ item_id: 'gp' }], error: null });
    const result = await fetchTiposContenedor(true);
    expect(result).toHaveLength(5);
    expect(result.find((t) => t.id === 'gp')?.activoOrg).toBe(false);
    expect(result.find((t) => t.id === 'inactive')?.activoOrg).toBe(false);
    expect(result.find((t) => t.id === 'dry')?.activoOrg).toBe(true);
    expect(mock.tableCalls.find((c) => c.table === 'tipos_contenedor')?.ops).not.toContain('eq');
  });
});
