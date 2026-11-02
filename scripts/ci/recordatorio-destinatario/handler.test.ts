import { describe, expect, it, vi } from 'vitest';
import { createDestinatarioRecordatorioHandler } from '../../../supabase/functions/cxc-recordatorio-destinatario/handler.ts';
import { resolveDestinatarioRecordatorio } from '../../../supabase/functions/_shared/recordatorioDestinatario.ts';
import { FACTURA_ID, fakeClient } from './fixtures';

const request = () => new Request('https://example.test/consulta', {
  method: 'POST', body: JSON.stringify({ factura_id: FACTURA_ID }),
});

function setup(options: Parameters<typeof fakeClient>[0] = {}) {
  const db = fakeClient(options);
  const authorize = vi.fn(async () => true);
  const resolve = vi.fn(resolveDestinatarioRecordatorio);
  const authenticate = vi.fn(async () => ({ userId: 'user-a', adminClient: db.client }));
  const handler = createDestinatarioRecordatorioHandler({
    authenticate, authorize, resolve, parseFacturaId: () => FACTURA_ID,
    preflight: () => null, cors: () => ({}),
  });
  return { ...db, handler, authorize, resolve, authenticate };
}

describe('consulta autorizada del destinatario del recordatorio', () => {
  it('mantiene el primer contacto con correo por antigüedad y sólo lee', async () => {
    const s = setup();
    const response = await s.handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, factura_id: FACTURA_ID, destinatario: 'anterior@example.test' });
    expect(s.authorize).toHaveBeenCalledWith(s.client, 'user-a', 'org-a');
    expect(s.resolve).toHaveBeenCalledWith(s.client, 'cliente-a');
    expect(s.from.mock.calls.map(([table]) => table)).toEqual(['facturas', 'contactos_cliente']);
    expect(s.writes).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('no usa el correo principal como fallback cuando faltan contactos', async () => {
    const s = setup({ contacts: [] });
    const response = await s.handler(request());
    expect(await response.json()).toMatchObject({ destinatario: null });
    expect(s.writes).not.toHaveBeenCalled();
  });

  it('rechaza antes de resolver correos cuando el rol o la organización no autorizan', async () => {
    const s = setup();
    s.authorize.mockResolvedValue(false);
    expect((await s.handler(request())).status).toBe(403);
    expect(s.resolve).not.toHaveBeenCalled();
    expect(s.writes).not.toHaveBeenCalled();
  });

  it('no consulta contactos sin factura ni sesión autorizada', async () => {
    const missing = setup({ factura: null });
    expect((await missing.handler(request())).status).toBe(404);
    expect(missing.resolve).not.toHaveBeenCalled();
    const denied = setup();
    denied.authenticate.mockRejectedValue(new Error('401: token inválido'));
    expect((await denied.handler(request())).status).toBe(401);
    expect(denied.from).not.toHaveBeenCalled();
  });

  it('un fallo de consulta no se presenta como cliente sin correo ni expone detalles', async () => {
    const s = setup({ contactError: true });
    const response = await s.handler(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'No se pudo consultar el destinatario' });
    expect(s.writes).not.toHaveBeenCalled();
  });

  it('valida el destinatario explícito sin sustituirlo por el contacto por defecto', async () => {
    const { client } = fakeClient();
    expect(await resolveDestinatarioRecordatorio(client, 'cliente-a', 'reciente@example.test'))
      .toBe('reciente@example.test');
    expect(await resolveDestinatarioRecordatorio(client, 'cliente-a', 'ajeno@example.test')).toBeNull();
    expect(await resolveDestinatarioRecordatorio(client, 'cliente-a', 'ya-no-existe@example.test')).toBeNull();
  });
});
