import assert from 'node:assert/strict';
import { FACTURA_A, FACTURA_B, request, withFixtureTransport } from './guardsFixtures.ts';

Deno.test('H21: adaptador real autentica, aplica rol de la empresa y sólo consulta su destinatario', async () => {
  await withFixtureTransport(async ({ calls, load }) => {
    const handler = await load('./index.ts');
    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, factura_id: FACTURA_A, destinatario: 'anterior-a@example.test' });
    assert.ok(calls.some(call => call.path === '/auth/v1/user'));
    assert.ok(calls.some(call => call.path === '/rest/v1/organization_members'
      && new URLSearchParams(call.query).get('organization_id') === 'eq.org-a'));
    assert.ok(calls.every(call => call.method === 'GET'));
  });
});

Deno.test('H21: factura ajena, usuario ajeno y admin global legacy no saltan membresía', async () => {
  await withFixtureTransport(async ({ tables, calls, load }) => {
    const handler = await load('./index.ts');
    tables.user_roles.push({ user_id: 'user-a', role: 'admin' });
    assert.equal((await handler(request(FACTURA_B))).status, 403);
    assert.equal((await handler(request(FACTURA_A, undefined, 'token-b'))).status, 403);
    assert.equal(calls.filter(call => call.path === '/rest/v1/contactos_cliente').length, 0);
  });
});

Deno.test('H21: una democión en la organización prevalece sobre el rol global permisivo', async () => {
  await withFixtureTransport(async ({ tables, calls, load }) => {
    const handler = await load('./index.ts');
    tables.organization_members[0].role = 'viewer';
    tables.user_roles.push({ user_id: 'user-a', role: 'admin' });
    assert.equal((await handler(request())).status, 403);
    assert.equal(calls.filter(call => call.path === '/rest/v1/contactos_cliente').length, 0);
  });
});

Deno.test('H21: el lector conserva la lista exacta de roles de cobranza por organización', async () => {
  const allowed = ['admin', 'admin_org', 'contador', 'ejecutivo_cobranza'];
  const denied = ['viewer', 'operador', 'tesorero', 'auxiliar_contable', 'gerente_comercial', 'cliente', 'agente_carga', 'super_admin'];
  for (const role of [...allowed, ...denied]) {
    await withFixtureTransport(async ({ tables, load }) => {
      tables.organization_members[0].role = role;
      const response = await (await load('./index.ts'))(request());
      assert.equal(response.status, allowed.includes(role) ? 200 : 403, role);
    });
  }
});

Deno.test('H21: conserva la excepción existente de super_admin de plataforma', async () => {
  await withFixtureTransport(async ({ tables, load }) => {
    tables.user_roles.push({ user_id: 'user-a', role: 'super_admin' });
    const response = await (await load('./index.ts'))(request(FACTURA_B));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).destinatario, 'ajeno-b@example.test');
  });
});

Deno.test('H21: token inválido y falta de token se rechazan antes de leer facturas', async () => {
  await withFixtureTransport(async ({ tokens, calls, load }) => {
    const handler = await load('./index.ts');
    tokens['token-a'] = null;
    assert.equal((await handler(request())).status, 401);
    const anonymous = new Request('https://example.test/consulta', { method: 'POST', body: '{}' });
    assert.equal((await handler(anonymous)).status, 401);
    assert.equal(calls.filter(call => call.path.startsWith('/rest/v1/')).length, 0);
  });
});

Deno.test('H21: retirar membresía tras preview impide enviar y no consulta contactos de nuevo', async () => {
  await withFixtureTransport(async ({ tables, calls, load }) => {
    const preview = await (await load('./index.ts'))(request());
    const email = (await preview.json()).destinatario;
    tables.organization_members = [];
    const reads = calls.filter(call => call.path === '/rest/v1/contactos_cliente').length;
    const response = await (await load('../cxc-recordatorio-enviar/index.ts'))(request(FACTURA_A, email));
    assert.equal(response.status, 403);
    assert.equal(calls.filter(call => call.path === '/rest/v1/contactos_cliente').length, reads);
    assert.ok(calls.every(call => call.method === 'GET' || call.path === '/rest/v1/rpc/saldo_factura'));
  });
});

Deno.test('H21: revocar el token tras preview impide enviar antes de consultar la factura', async () => {
  await withFixtureTransport(async ({ tokens, calls, load }) => {
    const preview = await (await load('./index.ts'))(request());
    const email = (await preview.json()).destinatario;
    tokens['token-a'] = null;
    const reads = calls.filter(call => call.path.startsWith('/rest/v1/')).length;
    const response = await (await load('../cxc-recordatorio-enviar/index.ts'))(request(FACTURA_A, email));
    assert.equal(response.status, 401);
    assert.equal(calls.filter(call => call.path.startsWith('/rest/v1/')).length, reads);
  });
});

Deno.test('H21: cambiar el correo confirmado y retirarlo de la allowlist rechaza sin fallback ni envío', async () => {
  await withFixtureTransport(async ({ tables, calls, load }) => {
    const preview = await (await load('./index.ts'))(request());
    const email = (await preview.json()).destinatario;
    tables.contactos_cliente[0].email = 'actualizado-a@example.test';
    const response = await (await load('../cxc-recordatorio-enviar/index.ts'))(request(FACTURA_A, email));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'El correo no pertenece a los contactos del cliente', code: 'DESTINATARIO_NO_PERMITIDO',
    });
    assert.ok(calls.every(call => call.method === 'GET' || call.path === '/rest/v1/rpc/saldo_factura'));
    assert.ok(!calls.some(call => call.path.includes('email_send_log') || call.path.includes('factura_recordatorios')));
  });
});

Deno.test('H21: un correo explícito de otro cliente se rechaza sin usar el destinatario por defecto', async () => {
  await withFixtureTransport(async ({ calls, load }) => {
    const response = await (await load('../cxc-recordatorio-enviar/index.ts'))(request(FACTURA_A, 'ajeno-b@example.test'));
    assert.equal(response.status, 400);
    assert.ok(!calls.some(call => call.path.includes('email_send_log') || call.path.includes('factura_recordatorios')));
  });
});

Deno.test('H21: si cambia el cliente de la factura y el correo deja su allowlist, se rechaza sin fallback', async () => {
  await withFixtureTransport(async ({ tables, calls, load }) => {
    const preview = await (await load('./index.ts'))(request());
    const email = (await preview.json()).destinatario;
    tables.clientes.push({ id: 'cliente-c', organization_id: 'org-a', email: 'principal-c@example.test', deleted_at: null });
    tables.contactos_cliente.push({ id: 'contacto-c', cliente_id: 'cliente-c', organization_id: 'org-a',
      email: 'contacto-c@example.test', created_at: '2026-01-01', deleted_at: null });
    tables.facturas[0].cliente_id = 'cliente-c';
    const response = await (await load('../cxc-recordatorio-enviar/index.ts'))(request(FACTURA_A, email));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'DESTINATARIO_NO_PERMITIDO');
    assert.ok(!calls.some(call => call.path.includes('email_send_log') || call.path.includes('factura_recordatorios')));
  });
});

Deno.test('H21: si la factura pasa a otra organización, se vuelve a exigir la membresía antes del envío', async () => {
  await withFixtureTransport(async ({ tables, calls, load }) => {
    const preview = await (await load('./index.ts'))(request());
    const email = (await preview.json()).destinatario;
    tables.facturas[0].organization_id = 'org-b';
    tables.facturas[0].cliente_id = 'cliente-b';
    const reads = calls.filter(call => call.path === '/rest/v1/contactos_cliente').length;
    const response = await (await load('../cxc-recordatorio-enviar/index.ts'))(request(FACTURA_A, email));
    assert.equal(response.status, 403);
    assert.equal(calls.filter(call => call.path === '/rest/v1/contactos_cliente').length, reads);
  });
});
