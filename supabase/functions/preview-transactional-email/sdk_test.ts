/** Real rendering and SDK transport contracts. Every fetch is intercepted; no email is sent. */
import assert from 'node:assert/strict';
import * as React from 'npm:react@18.3.1';
import * as ReactDOM from 'npm:react-dom@18.3.1';
import { EmailAPIError } from 'npm:@lovable.dev/email-js@0.6.0';
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts';
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts';
import snapshots from './sdk_snapshots.json' with { type: 'json' };

const API_KEY = 'offline-transactional-key';
const SEND_URL = 'https://email.example.test/send';
const RECIPIENT = 'recipient@example.test';
const REPLY_TO = 'executive@example.test';
const DEFAULT_SEND_URL = 'https://api.lovable.dev/v1/messaging/email/send';
const NAMES = [
  'cotizacion-respuesta', 'cotizacion-enviada', 'proforma-enviada', 'factura-enviada',
  'nota-credito-enviada', 'rep-enviado', 'recordatorio-cobranza', 'estado-cuenta-cliente',
];

type Payload = Record<string, unknown> & {
  to: string; from: string; sender_domain: string; subject: string; html: string;
  text: string; purpose: string; label: string; idempotency_key: string; reply_to?: string;
};
type SendCall = { url: string; headers: Headers; payload: Payload };

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Only these fake application values are visible to the adapter. */
async function isolated<T>(run: () => Promise<T>): Promise<T> {
  const names = ['LOVABLE_API_KEY', 'LOVABLE_SEND_URL'];
  const saved = names.map((name) => Deno.env.get(name));
  const fetch = globalThis.fetch;
  Deno.env.set('LOVABLE_API_KEY', API_KEY);
  Deno.env.set('LOVABLE_SEND_URL', SEND_URL);
  globalThis.fetch = () => Promise.reject(new Error('Unexpected fetch: no transport stub installed'));
  try {
    return await run();
  } finally {
    globalThis.fetch = fetch;
    names.forEach((name, index) => {
      const value = saved[index];
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    });
  }
}

function transport(
  calls: SendCall[],
  respond: () => Response | Promise<Response> = () => Response.json({ id: 'offline-message' }),
  expectedUrl = SEND_URL,
): void {
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    assert.equal(url, expectedUrl, 'unexpected destination must never reach the network');
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), `Bearer ${API_KEY}`);
    assert.equal(headers.get('content-type'), 'application/json');
    const payload = JSON.parse(String(init?.body)) as Payload;
    assert.equal(headers.get('idempotency-key'), payload.idempotency_key);
    calls.push({ url, headers, payload });
    return await respond();
  };
}

Deno.test('transactional SDK: eight real React 18 templates preserve HTML/text snapshots and send contract', async () => {
  await isolated(async () => {
    assert.equal(React.version, '18.3.1');
    assert.equal(ReactDOM.version, '18.3.1');
    assert.deepEqual(Object.keys(TEMPLATES), NAMES);
    assert.deepEqual(Object.keys(snapshots), NAMES);
    const calls: SendCall[] = [];
    transport(calls);
    for (const name of NAMES) {
      const entry = TEMPLATES[name];
      const templateData = { ...entry.previewData, ejecutivoEmail: REPLY_TO };
      const result = await sendTemplateEmail(name, RECIPIENT, {
        templateData, idempotencyKey: `offline-${name}`, replyTo: REPLY_TO,
      });
      assert.deepEqual(result, { sent: true });
      const payload = calls.at(-1)!.payload;
      assert.deepEqual(Object.keys(payload).sort(), [
        'from', 'html', 'idempotency_key', 'label', 'purpose', 'reply_to',
        'sender_domain', 'subject', 'text', 'to',
      ]);
      assert.equal(payload.to, RECIPIENT);
      assert.equal(payload.from, 'Elogistix Platform <noreply@librecarga.com>');
      assert.equal(payload.sender_domain, 'notify.librecarga.com');
      assert.equal(payload.purpose, 'transactional');
      assert.equal(payload.label, name);
      assert.equal(payload.reply_to, REPLY_TO);
      assert.match(payload.html, /<!DOCTYPE html/);
      assert.match(payload.html, /ACME/);
      assert.match(payload.text, /ACME/);
      assert.doesNotMatch(payload.text, /<html/);
      const snapshot = snapshots[name as keyof typeof snapshots];
      assert.equal(payload.subject, snapshot.subject);
      assert.equal(await sha256(payload.html), snapshot.htmlSha256, `${name} HTML`);
      assert.equal(await sha256(payload.text), snapshot.textSha256, `${name} plain text`);
    }
    assert.equal(calls.length, 8);
  });
});

Deno.test('transactional SDK: explicit idempotency survives retries; generated keys and default endpoint remain intact', async () => {
  await isolated(async () => {
    const calls: SendCall[] = [];
    transport(calls);
    const options = { templateData: TEMPLATES['factura-enviada'].previewData, idempotencyKey: 'offline-retry-key' };
    await sendTemplateEmail('factura-enviada', RECIPIENT, options);
    await sendTemplateEmail('factura-enviada', RECIPIENT, options);
    assert.equal(calls[0].headers.get('idempotency-key'), 'offline-retry-key');
    assert.deepEqual(calls[0].payload, calls[1].payload);
    assert.equal(Object.hasOwn(calls[0].payload, 'reply_to'), false);
    Deno.env.delete('LOVABLE_SEND_URL');
    transport(calls, undefined, DEFAULT_SEND_URL);
    await sendTemplateEmail('factura-enviada', RECIPIENT, { templateData: options.templateData });
    await sendTemplateEmail('factura-enviada', RECIPIENT, { templateData: options.templateData });
    for (const call of calls.slice(2)) {
      assert.match(call.payload.idempotency_key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      assert.equal(Object.hasOwn(call.payload, 'provider'), false);
      assert.equal(Object.hasOwn(call.payload, 'cc'), false);
      assert.equal(Object.hasOwn(call.payload, 'bcc'), false);
    }
    assert.notEqual(calls[2].payload.idempotency_key, calls[3].payload.idempotency_key);
    assert.equal(calls.length, 4);
  });
});

Deno.test('transactional SDK: suppression is expected; HTTP errors and retry metadata remain actionable', async () => {
  await isolated(async () => {
    const calls: SendCall[] = [];
    const options = { templateData: TEMPLATES['factura-enviada'].previewData, idempotencyKey: 'offline-error' };
    transport(calls, () => Response.json({ type: 'recipient_suppressed' }, { status: 400 }));
    assert.deepEqual(await sendTemplateEmail('factura-enviada', RECIPIENT, options), {
      sent: false, reason: 'recipient_suppressed',
    });
    for (const status of [400, 401, 429, 500]) {
      const code = `offline_${status}`;
      transport(calls, () => Response.json({ type: code }, { status, headers: { 'Retry-After': '17' } }));
      await assert.rejects(sendTemplateEmail('factura-enviada', RECIPIENT, options), (error: unknown) => {
        assert.ok(error instanceof EmailAPIError);
        assert.equal(error.status, status);
        assert.equal(error.code, code);
        assert.equal(error.retryAfterSeconds, 17);
        assert.equal(error.retryable, status === 429 || status === 500);
        return true;
      });
    }
    const offlineFailure = new TypeError('offline simulated connection failure');
    transport(calls, () => Promise.reject(offlineFailure));
    await assert.rejects(sendTemplateEmail('factura-enviada', RECIPIENT, options), (error: unknown) => error === offlineFailure);
    assert.equal(calls.length, 6, 'SDK must not perform hidden retries');
  });
});

Deno.test('transactional SDK: invalid local configuration is rejected before transport', async () => {
  await isolated(async () => {
    let sends = 0;
    globalThis.fetch = () => { sends++; return Promise.reject(new Error('unexpected fetch')); };
    await assert.rejects(sendTemplateEmail('missing-template', RECIPIENT), /not found/);
    await assert.rejects(sendTemplateEmail('factura-enviada', ''), /Recipient is required/);
    Deno.env.delete('LOVABLE_API_KEY');
    await assert.rejects(sendTemplateEmail('factura-enviada', RECIPIENT), /not configured/);
    assert.equal(sends, 0);
  });
});

Deno.test('transactional preview: actual adapter renders all eight templates and never sends', async () => {
  await isolated(async () => {
    let sends = 0;
    globalThis.fetch = () => { sends++; return Promise.reject(new Error('preview must never fetch')); };
    let handler: ((request: Request) => Response | Promise<Response>) | undefined;
    const descriptor = Object.getOwnPropertyDescriptor(Deno, 'serve')!;
    Object.defineProperty(Deno, 'serve', {
      configurable: true, enumerable: descriptor.enumerable, writable: true,
      value: (callback: typeof handler) => { handler = callback; return {}; },
    });
    try {
      await import('./index.ts');
    } finally {
      Object.defineProperty(Deno, 'serve', descriptor);
    }
    assert.ok(handler, 'adapter must register its real handler');
    const request = (authorization?: string, method = 'GET') => new Request('https://preview.example.test/', {
      method, headers: authorization ? { authorization } : undefined,
    });
    assert.equal((await handler(request(undefined, 'OPTIONS'))).status, 200);
    assert.equal((await handler(request('Bearer invalid-offline-key'))).status, 401);
    Deno.env.delete('LOVABLE_API_KEY');
    assert.equal((await handler(request())).status, 500);
    Deno.env.set('LOVABLE_API_KEY', API_KEY);
    const response = await handler(request(`Bearer ${API_KEY}`));
    assert.equal(response.status, 200);
    const { templates } = await response.json() as {
      templates: Array<{ templateName: string; subject: string; html: string; status: string }>;
    };
    assert.deepEqual(templates.map((entry) => entry.templateName), NAMES);
    for (const entry of templates) {
      assert.equal(entry.status, 'ready');
      const snapshot = snapshots[entry.templateName as keyof typeof snapshots];
      assert.equal(entry.subject, snapshot.subject);
      assert.equal(await sha256(entry.html), snapshot.previewHtmlSha256, `${entry.templateName} preview`);
    }
    assert.equal(sends, 0);
  });
});
