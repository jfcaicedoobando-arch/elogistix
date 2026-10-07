import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '@/services/__tests__/_supabaseChainMock';
import { setAuthSnapshot } from '@/lib/auth/authSnapshot';
import { syncActiveOrganizationScope } from '@/lib/auth/authOperationScope';

const { mock } = vi.hoisted(() => ({
  mock: { current: null as ReturnType<typeof createSupabaseMock> | null },
}));
vi.mock('@/integrations/supabase/client', () => ({
  get supabase() { return mock.current!.supabase; },
}));
vi.mock('@/services/bitacora/registrar', () => ({ registrarActividad: vi.fn() }));

import { fetchEmisorEmpresa, invalidarEmisorCache } from '../emisor';
import { updateConfiguracionByCategoriaClave } from '../configuracionClaves';

function useOrg(organizationId: string | null, userId = 'user-sintetico') {
  setAuthSnapshot({ userId, email: null, organizationId: null, organizationName: null,
    role: 'super_admin', effectiveRole: 'super_admin' });
  syncActiveOrganizationScope({ userId, organizationId });
  mock.current!.setRpcResult('org_scope', { data: organizationId, error: null });
}
function configured(nombre: string) {
  mock.current!.setTableResult('configuracion', { data: [{ clave: 'nombre', valor: nombre }], error: null });
}
function deferredConfig() {
  let resolve!: (value: { data: { clave: string; valor: string }[]; error: null }) => void;
  const promise = new Promise<{ data: { clave: string; valor: string }[]; error: null }>((r) => { resolve = r; });
  mock.current!.supabase.from.mockImplementationOnce(() => ({
    select: () => ({ eq: () => ({ eq: () => promise }) }),
  }));
  return resolve;
}

describe('configuracion/emisor: identidad aislada', () => {
  beforeEach(() => {
    invalidarEmisorCache();
    mock.current = createSupabaseMock();
    useOrg('org-sintetica-a');
  });

  it('obtiene únicamente la configuración del tenant activo', async () => {
    configured('Comercial A');
    expect((await fetchEmisorEmpresa()).razonSocial).toBe('Comercial A');
    expect(mock.current!.tableCalls[0].opArgs).toContainEqual(['organization_id', 'org-sintetica-a']);
    expect(mock.current!.tableCalls[0].opArgs).toContainEqual(['categoria', 'empresa']);
  });

  it('sin configuración conserva fallback sin inventar RFC ni razón social del tenant', async () => {
    mock.current!.setTableResult('configuracion', { data: [], error: null });
    expect(await fetchEmisorEmpresa()).toEqual({ razonSocial: 'Empresa', subtitulo: '', rfc: '', direccion: '', contacto: '' });
  });

  it('reutiliza caché sólo dentro de la misma organización y usuario', async () => {
    configured('Comercial A');
    await fetchEmisorEmpresa();
    configured('No debe leer durante TTL');
    expect((await fetchEmisorEmpresa()).razonSocial).toBe('Comercial A');
    expect(mock.current!.tableCalls).toHaveLength(1);
    useOrg('org-sintetica-b');
    configured('Comercial B');
    expect((await fetchEmisorEmpresa()).razonSocial).toBe('Comercial B');
    useOrg('org-sintetica-b', 'otro-usuario-sintetico');
    configured('Comercial B actualizada');
    expect((await fetchEmisorEmpresa()).razonSocial).toBe('Comercial B actualizada');
    expect(mock.current!.tableCalls).toHaveLength(3);
  });

  it('sin organización falla antes de consultar configuración', async () => {
    useOrg(null);
    await expect(fetchEmisorEmpresa()).rejects.toThrow('Selecciona una organización');
    expect(mock.current!.tableCalls).toHaveLength(0);
  });

  it('propaga errores de org_scope, incluso cuando existe caché', async () => {
    configured('Comercial A');
    await fetchEmisorEmpresa();
    mock.current!.setRpcResult('org_scope', { data: null, error: new Error('scope falló') });
    await expect(fetchEmisorEmpresa()).rejects.toThrow('scope falló');
    expect(mock.current!.tableCalls).toHaveLength(1);
  });

  it('no mezcla una selección local con el tenant previo aún persistido', async () => {
    mock.current!.setRpcResult('org_scope', { data: 'org-sintetica-b', error: null });
    await expect(fetchEmisorEmpresa()).rejects.toThrow('aún no está sincronizada');
    expect(mock.current!.tableCalls).toHaveLength(0);
  });

  it('un error de configuración no se convierte en emisor vacío ni se cachea', async () => {
    mock.current!.setTableResult('configuracion', { data: null, error: new Error('lectura falló') });
    await expect(fetchEmisorEmpresa()).rejects.toThrow('lectura falló');
    configured('Comercial recuperada');
    expect((await fetchEmisorEmpresa()).razonSocial).toBe('Comercial recuperada');
  });

  it('una respuesta nula tampoco se confunde con configuración ausente', async () => {
    mock.current!.setTableResult('configuracion', { data: null, error: null });
    await expect(fetchEmisorEmpresa()).rejects.toThrow('No se pudo leer');
  });

  it('rechaza respuesta tardía del tenant anterior y no contamina su nueva caché', async () => {
    const resolve = deferredConfig();
    const previous = fetchEmisorEmpresa();
    const rejected = expect(previous).rejects.toThrow('cambió el usuario o la organización');
    await vi.waitFor(() => expect(mock.current!.supabase.from).toHaveBeenCalledOnce());
    useOrg('org-sintetica-b');
    configured('Comercial B');
    expect((await fetchEmisorEmpresa()).razonSocial).toBe('Comercial B');
    resolve({ data: [{ clave: 'nombre', valor: 'Comercial A tardía' }], error: null });
    await rejected;
    expect((await fetchEmisorEmpresa()).razonSocial).toBe('Comercial B');
    expect(mock.current!.supabase.from).toHaveBeenCalledTimes(2);
  });

  it('invalida al guardar empresa aunque otra clave falle después de una escritura parcial', async () => {
    configured('Comercial anterior');
    await fetchEmisorEmpresa();
    mock.current!.setTableResultOnce('configuracion', { data: [{ id: 'config-sintetica' }], error: null });
    mock.current!.setTableResultOnce('configuracion', { data: null, error: new Error('otra clave falló') });
    await expect(updateConfiguracionByCategoriaClave('org-sintetica-a', [
      { categoria: 'empresa', clave: 'nombre', valor: 'Comercial nueva' },
      { categoria: 'empresa', clave: 'subtitulo', valor: 'Giro' },
    ])).rejects.toThrow('otra clave falló');
    configured('Comercial nueva');
    expect((await fetchEmisorEmpresa()).razonSocial).toBe('Comercial nueva');
  });

  it('una lectura iniciada antes de invalidar no repuebla la caché obsoleta', async () => {
    const resolve = deferredConfig();
    const previous = fetchEmisorEmpresa();
    await vi.waitFor(() => expect(mock.current!.supabase.from).toHaveBeenCalledOnce());
    invalidarEmisorCache();
    configured('Nombre vigente');
    resolve({ data: [{ clave: 'nombre', valor: 'Nombre previo' }], error: null });
    expect((await previous).razonSocial).toBe('Nombre vigente');
    expect((await fetchEmisorEmpresa()).razonSocial).toBe('Nombre vigente');
    expect(mock.current!.supabase.from).toHaveBeenCalledTimes(2);
  });
});
