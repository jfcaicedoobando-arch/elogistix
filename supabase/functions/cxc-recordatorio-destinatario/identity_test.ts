import assert from 'node:assert/strict';
import { FACTURA_A, request, withFixtureTransport } from './guardsFixtures.ts';

Deno.test('H21 v2: preview sólo ofrece contactos y cliente activos de la organización de factura', async () => {
  for (const change of ['contacto-baja', 'contacto-ajeno', 'cliente-baja', 'cliente-ajeno', 'sin-correo', 'correo-invalido']) {
    await withFixtureTransport(async ({ tables, calls, load }) => {
      if (change === 'contacto-baja') tables.contactos_cliente[0].deleted_at = '2026-11-02';
      if (change === 'contacto-ajeno') tables.contactos_cliente[0].organization_id = tables.facturas[1].organization_id;
      if (change === 'cliente-baja') tables.clientes[0].deleted_at = '2026-11-02';
      if (change === 'cliente-ajeno') tables.clientes[0].organization_id = tables.facturas[1].organization_id;
      if (change === 'sin-correo') tables.contactos_cliente = [];
      if (change === 'correo-invalido') tables.contactos_cliente[0].email = '   ';
      const response = await (await load('./index.ts'))(request());
      const body = await response.json();
      if (change.startsWith('cliente-')) {
        assert.equal(response.status, 409, change);
        assert.equal(body.code, 'CLIENTE_NO_DISPONIBLE');
      } else {
        assert.equal(response.status, 200, change);
        assert.equal(body.destinatario?.email ?? null,
          change.startsWith('contacto-') ? 'reciente-a@example.test' : null, change);
      }
      assert.ok(calls.every(call => call.method === 'GET'), change);
    });
  }
});

Deno.test('H21 v2: otra entrada y clientes.email con el mismo correo no salvan la identidad obsoleta', async () => {
  for (const change of ['contacto-baja', 'contacto-borrado', 'correo', 'cliente-baja', 'contacto-otro-cliente', 'contacto-otra-org', 'cliente-otra-org']) {
    await withFixtureTransport(async ({ tables, calls, load }) => {
      const target = (await (await (await load('./index.ts'))(request())).json()).destinatario;
      tables.clientes[0].email = target.email;
      tables.contactos_cliente[1].email = target.email;
      if (change === 'contacto-baja') tables.contactos_cliente[0].deleted_at = '2026-11-02';
      if (change === 'contacto-borrado') tables.contactos_cliente.shift();
      if (change === 'correo') tables.contactos_cliente[0].email = 'nuevo@example.test';
      if (change === 'cliente-baja') tables.clientes[0].deleted_at = '2026-11-02';
      if (change === 'contacto-otro-cliente') tables.contactos_cliente[0].cliente_id = tables.clientes[1].id;
      if (change === 'contacto-otra-org') tables.contactos_cliente[0].organization_id = tables.clientes[1].organization_id;
      if (change === 'cliente-otra-org') tables.clientes[0].organization_id = tables.clientes[1].organization_id;
      const response = await (await load('../cxc-recordatorio-confirmar/index.ts'))(request(FACTURA_A, target));
      assert.equal(response.status, 409, change);
      assert.equal((await response.json()).code, change === 'correo' ? 'DESTINATARIO_CAMBIO'
        : change.startsWith('cliente-') ? 'CLIENTE_NO_DISPONIBLE' : 'CONTACTO_NO_DISPONIBLE', change);
      assert.ok(calls.every(call => call.method === 'GET'), change);
    });
  }
});

Deno.test('H21 v2: ambos adaptadores de envío rechazan payload viejo o identidad incompleta antes de leer datos', async () => {
  for (const endpoint of ['../cxc-recordatorio-enviar/index.ts', '../cxc-recordatorio-confirmar/index.ts']) {
    await withFixtureTransport(async ({ calls, load }) => {
      const handler = await load(endpoint);
      for (const body of [
        { factura_id: FACTURA_A, contacto_email: 'anterior-a@example.test' },
        { factura_id: FACTURA_A, confirmacion_version: 2, destinatario_confirmado: { email: 'anterior-a@example.test' } },
      ]) {
        const response = await handler(new Request(request(), { body: JSON.stringify(body) }));
        assert.equal(response.status, 409);
        assert.equal((await response.json()).code, 'CONFIRMACION_DESTINATARIO_REQUERIDA');
      }
      assert.ok(calls.every(call => call.path === '/auth/v1/user'));
    });
  }
});

Deno.test('H21 v2: confirmar vuelve a exigir rol y empresa y no calcula saldo antes de autorizar', async () => {
  for (const change of ['rol', 'empresa']) {
    await withFixtureTransport(async ({ tables, calls, load }) => {
      const target = (await (await (await load('./index.ts'))(request())).json()).destinatario;
      if (change === 'rol') tables.organization_members[0].role = 'viewer';
      else tables.facturas[0].organization_id = tables.facturas[1].organization_id;
      const response = await (await load('../cxc-recordatorio-confirmar/index.ts'))(request(FACTURA_A, target));
      assert.equal(response.status, 403);
      assert.ok(!calls.some(call => call.path === '/rest/v1/rpc/saldo_factura'));
    });
  }
});

Deno.test('H21 v2: la última validación detecta cambios durante preparación antes del transporte', async () => {
  for (const change of ['correo', 'contacto-baja', 'cliente-baja', 'factura-cliente', 'membresia']) {
    await withFixtureTransport(async ({ tables, controls, calls, load }) => {
      const target = (await (await (await load('./index.ts'))(request())).json()).destinatario;
      controls.beforeRead = table => {
        if (table !== 'organizations') return;
        if (change === 'correo') tables.contactos_cliente[0].email = 'nuevo@example.test';
        if (change === 'contacto-baja') tables.contactos_cliente[0].deleted_at = '2026-11-02';
        if (change === 'cliente-baja') tables.clientes[0].deleted_at = '2026-11-02';
        if (change === 'factura-cliente') tables.facturas[0].cliente_id = tables.facturas[1].cliente_id;
        if (change === 'membresia') tables.organization_members = [];
      };
      const response = await (await load('../cxc-recordatorio-confirmar/index.ts'))(request(FACTURA_A, target));
      assert.equal(response.status, change === 'membresia' ? 403 : 409, change);
      assert.ok(!calls.some(call => call.path === '/fixture-mail' || call.path.includes('email_send_log')
        || call.path.includes('factura_recordatorios')), change);
    });
  }
});
