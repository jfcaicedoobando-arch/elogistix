import assert from 'node:assert/strict';
import { FACTURA_A, request, withFixtureTransport } from './guardsFixtures.ts';

Deno.test('H21 v2: plantilla y SDK reales envían exactamente al contacto mostrado y después registran historial', async () => {
  await withFixtureTransport(async ({ tables, delivery, calls, load }) => {
    const target = (await (await (await load('./index.ts'))(request())).json()).destinatario;
    // Un cambio ajeno al correo/identidad no invalida toda la ficha.
    tables.contactos_cliente[0].telefono = '5550000000';
    tables.contactos_cliente[0].updated_at = '2026-11-02T22:00:00Z';
    delivery.enabled = true;
    const response = await (await load('../cxc-recordatorio-confirmar/index.ts'))(request(FACTURA_A, target));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, enviado_a: target.email });
    assert.equal(delivery.emails.length, 1);
    assert.equal(delivery.emails[0].to, target.email);
    assert.equal(delivery.emails[0].label, 'recordatorio-cobranza');
    assert.ok(String(delivery.emails[0].html).includes('QA-A'));
    assert.match(String(delivery.emails[0].idempotency_key), new RegExp(`^recordatorio-${FACTURA_A}-email-\\d+$`));
    assert.equal(delivery.logs[0].p_status, 'sent');
    assert.equal(delivery.logs[0].p_recipient, target.email);
    assert.equal(delivery.history.length, 1);
    assert.equal(delivery.history[0].factura_id, FACTURA_A);
    assert.equal(delivery.history[0].organization_id, target.organization_id);
    assert.ok(calls.findIndex(call => call.path === '/fixture-mail')
      < calls.findIndex(call => call.path === '/rest/v1/factura_recordatorios'));
  });
});

Deno.test('H21 v2: fallo del transporte ficticio no crea historial de recordatorio enviado', async () => {
  await withFixtureTransport(async ({ delivery, load }) => {
    const target = (await (await (await load('./index.ts'))(request())).json()).destinatario;
    delivery.enabled = true;
    delivery.status = 400;
    const response = await (await load('../cxc-recordatorio-confirmar/index.ts'))(request(FACTURA_A, target));
    assert.equal(response.status, 500);
    assert.equal(delivery.emails.length, 1);
    assert.equal(delivery.history.length, 0);
    assert.equal(delivery.logs[0].p_status, 'failed');
  });
});

Deno.test('H21 v2: fallo del historial tras envío exitoso devuelve éxito y no repite el transporte', async () => {
  await withFixtureTransport(async ({ delivery, load }) => {
    const target = (await (await (await load('./index.ts'))(request())).json()).destinatario;
    delivery.enabled = true;
    delivery.historyStatus = 400;
    const response = await (await load('../cxc-recordatorio-enviar/index.ts'))(request(FACTURA_A, target));
    assert.equal(response.status, 200);
    assert.equal(delivery.emails.length, 1);
    assert.equal(delivery.history.length, 1);
    assert.equal(delivery.logs[0].p_status, 'sent');
  });
});

Deno.test('H21: conserva la clave idempotente de la ventana existente sin prometer deduplicación local', async () => {
  await withFixtureTransport(async () => {
    const { messageIdRecordatorio } = await import('../_shared/recordatorio/entrega.ts');
    assert.equal(messageIdRecordatorio(FACTURA_A, 'email', 600_001), messageIdRecordatorio(FACTURA_A, 'email', 1_199_999));
    assert.notEqual(messageIdRecordatorio(FACTURA_A, 'email', 600_001), messageIdRecordatorio(FACTURA_A, 'email', 1_200_000));
  });
});
