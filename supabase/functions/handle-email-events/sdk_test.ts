import assert from 'node:assert/strict'
import { AuthClient } from 'npm:@supabase/auth-js@2.118.0'

// Exercise the production adapter and SDK with signed requests. The only
// transport below is an in-memory PostgREST stub; --deny-net is intentional.
const API_KEY = 'offline-webhook-secret'
const SERVICE_KEY = 'offline-service-role-key'
const DATABASE_URL = 'https://offline-database.invalid'
type EventType = 'email.bounced' | 'email.complaint' | 'email.unsubscribed'
type Row = Record<string, unknown>

async function signedRequest(
  body: string,
  timestamp = String(Math.floor(Date.now() / 1000)),
  secret = API_KEY,
): Promise<Request> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`))
  const hex = Array.from(new Uint8Array(signature), (value) => value.toString(16).padStart(2, '0')).join('')
  return new Request('https://offline-webhook.invalid/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-lovable-timestamp': timestamp,
      'x-lovable-signature': `sha256=${hex}`,
    },
    body,
  })
}

function eventBody(type: EventType, messageId: string | undefined = `message-${type}`): string {
  return JSON.stringify({
    version: '1', type, event_id: `event-${type}`, run_id: 'offline-run',
    project_id: 'offline-project', environment: 'dev', timestamp: new Date().toISOString(),
    data: { event: type, recipient: 'Recipient@Example.Test', message_id: messageId },
  })
}

Deno.test('email webhook SDK: real adapter verifies signatures and records terminal events offline', async (test) => {
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'LOVABLE_API_KEY']
  const previousEnv = keys.map((key) => Deno.env.get(key))
  const originalFetch = globalThis.fetch
  const originalServe = Object.getOwnPropertyDescriptor(Deno, 'serve')!
  const originalStartAutoRefresh = AuthClient.prototype.startAutoRefresh
  const authClients = new Set<InstanceType<typeof AuthClient>>()
  const calls: { path: string; body: Row }[] = []
  const unexpectedDestinations: string[] = []
  const suppressed = new Map<string, Row>()
  const sendLog = new Map<string, Row>()
  let failTable: 'suppressed_emails' | 'email_send_log_touch' | undefined
  let handler: ((request: Request) => Response | Promise<Response>) | undefined

  Deno.env.set('SUPABASE_URL', DATABASE_URL)
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY)
  Deno.env.set('LOVABLE_API_KEY', API_KEY)
  // The real adapter owns a long-lived Supabase client. Track its public
  // lifecycle so the test can shut it down without disabling leak detection.
  AuthClient.prototype.startAutoRefresh = async function () {
    authClients.add(this)
    await originalStartAutoRefresh.call(this)
  }
  Object.defineProperty(Deno, 'serve', {
    configurable: true, writable: true,
    value: (serveHandler: typeof handler) => { handler = serveHandler },
  })
  globalThis.fetch = async (input, init): Promise<Response> => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.origin !== DATABASE_URL || ![
      '/rest/v1/suppressed_emails', '/rest/v1/rpc/email_send_log_touch',
    ].includes(url.pathname)) {
      unexpectedDestinations.push(request.url)
      throw new Error(`Unexpected offline webhook destination: ${request.url}`)
    }
    assert.equal(request.method, 'POST')
    assert.equal(request.headers.get('apikey'), SERVICE_KEY)
    assert.equal(request.headers.get('authorization'), `Bearer ${SERVICE_KEY}`)
    const body = await request.json() as Row
    calls.push({ path: url.pathname, body })
    if (url.pathname === '/rest/v1/suppressed_emails') {
      assert.equal(url.searchParams.get('on_conflict'), 'email')
      assert.equal(url.searchParams.size, 1)
      assert.ok(request.headers.get('prefer')?.includes('resolution=merge-duplicates'))
      if (failTable === 'suppressed_emails') return Response.json({ code: 'offline_db_error', message: 'fixture' }, { status: 500 })
      suppressed.set(String(body.email), body)
      return new Response(null, { status: 201 })
    }
    assert.equal(url.searchParams.size, 0)
    if (failTable === 'email_send_log_touch') return Response.json({ code: 'offline_db_error', message: 'fixture' }, { status: 500 })
    sendLog.set(String(body.p_message_id), body)
    return Response.json({})
  }

  try {
    await import('./index.ts')
    assert.ok(handler, 'The production adapter must register its real HTTP handler')
    const handle = handler
    const checkNoWrites = async (request: Request, status: number, payload: Row) => {
      const before = calls.length
      const response = await handle(request)
      assert.equal(response.status, status)
      assert.deepEqual(await response.json(), payload)
      assert.equal(calls.length, before, 'Rejected or ignored events must not touch the database')
    }

    const terminalEvents = [
      ['email.bounced', 'bounce', 'bounced', 'Permanent bounce — email address is invalid or rejected'],
      ['email.complaint', 'complaint', 'complained', 'Spam complaint — recipient marked email as spam'],
      ['email.unsubscribed', 'unsubscribe', 'suppressed', 'Recipient unsubscribed'],
    ] as const
    for (const [type, reason, status, message] of terminalEvents) {
      await test.step(`${type}: valid HMAC updates suppression and the original message`, async () => {
        const before = calls.length
        const response = await handle(await signedRequest(eventBody(type)))
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), { received: true })
        assert.equal(calls.length, before + 2)
        assert.deepEqual(suppressed.get('recipient@example.test'), {
          email: 'recipient@example.test', reason, metadata: null,
        })
        assert.deepEqual(sendLog.get(`message-${type}`), {
          p_message_id: `message-${type}`, p_template: 'system',
          p_recipient: 'recipient@example.test', p_status: status, p_error: message,
        })
      })
    }

    await test.step('a signed replay repeats idempotent writes without adding logical rows', async () => {
      // The SDK verifies freshness, not event-id deduplication. The adapter
      // handles accepted re-deliveries with email upsert and message-id RPC.
      const body = eventBody('email.bounced')
      const before = calls.length
      const sizes = [suppressed.size, sendLog.size]
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await handle(await signedRequest(body))
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), { received: true })
      }
      assert.equal(calls.length, before + 4)
      assert.deepEqual([suppressed.size, sendLog.size], sizes)
      assert.deepEqual(calls.slice(-4, -2), calls.slice(-2))
    })

    await test.step('missing provider message id uses the event id as its existing fallback', async () => {
      const payload = JSON.parse(eventBody('email.bounced'))
      delete payload.data.message_id
      const response = await handle(await signedRequest(JSON.stringify(payload)))
      assert.equal(response.status, 200)
      await response.text()
      assert.equal(calls.at(-1)?.body.p_message_id, 'event-email.bounced')
    })

    await test.step('GET is rejected before verification or database access', async () => {
      await checkNoWrites(new Request('https://offline-webhook.invalid/events'), 405, { error: 'Method not allowed' })
    })
    await test.step('invalid HMAC is rejected', async () => {
      await checkNoWrites(await signedRequest(eventBody('email.bounced'), undefined, 'wrong-offline-key'), 401, { error: 'Invalid webhook signature' })
    })
    await test.step('missing signature is rejected', async () => {
      const request = await signedRequest(eventBody('email.bounced'))
      request.headers.delete('x-lovable-signature')
      await checkNoWrites(request, 401, { error: 'Invalid webhook signature' })
    })
    await test.step('body tampering invalidates its signature', async () => {
      const request = await signedRequest(eventBody('email.bounced'))
      await checkNoWrites(new Request(request.url, {
        method: 'POST', headers: request.headers, body: eventBody('email.complaint'),
      }), 401, { error: 'Invalid webhook signature' })
    })
    await test.step('missing timestamp is rejected', async () => {
      const request = await signedRequest(eventBody('email.bounced'))
      request.headers.delete('x-lovable-timestamp')
      await checkNoWrites(request, 401, { error: 'Missing webhook timestamp' })
    })
    await test.step('invalid timestamp is rejected', async () => {
      await checkNoWrites(await signedRequest(eventBody('email.bounced'), 'not-a-timestamp'), 401, { error: 'Invalid webhook timestamp' })
    })
    for (const [description, offset] of [['expired', -301], ['future', 301]] as const) {
      await test.step(`${description} timestamp beyond the five-minute tolerance is rejected`, async () => {
        await checkNoWrites(await signedRequest(eventBody('email.bounced'), String(Math.floor(Date.now() / 1000) + offset)), 401, { error: 'Webhook timestamp outside tolerance window' })
      })
    }
    await test.step('signed invalid JSON is rejected', async () => {
      await checkNoWrites(await signedRequest('{'), 400, { error: 'Failed to parse webhook payload' })
    })
    await test.step('signed missing envelope fields are rejected', async () => {
      await checkNoWrites(await signedRequest('{}'), 400, { error: 'Failed to parse webhook payload' })
    })
    await test.step('unknown versions and unhandled event types acknowledge without writes', async () => {
      const payload = JSON.parse(eventBody('email.bounced'))
      payload.version = '2'
      await checkNoWrites(await signedRequest(JSON.stringify(payload)), 200, { received: true })
      payload.version = '1'
      payload.type = 'email.resubscribed'
      await checkNoWrites(await signedRequest(JSON.stringify(payload)), 200, { received: true })
    })
    for (const target of ['suppressed_emails', 'email_send_log_touch'] as const) {
      await test.step(`${target} failure returns 500 for provider retry`, async () => {
        failTable = target
        const before = calls.length
        try {
          const response = await handle(await signedRequest(eventBody('email.bounced')))
          assert.equal(response.status, 500)
          assert.deepEqual(await response.json(), { error: 'Handler failed' })
          assert.equal(calls.length, before + (target === 'suppressed_emails' ? 1 : 2))
        } finally {
          failTable = undefined
        }
      })
    }
    assert.deepEqual(unexpectedDestinations, [], 'Even swallowed transport errors must expose an unexpected destination')
  } finally {
    for (const client of authClients) await client.stopAutoRefresh()
    AuthClient.prototype.startAutoRefresh = originalStartAutoRefresh
    globalThis.fetch = originalFetch
    Object.defineProperty(Deno, 'serve', originalServe)
    keys.forEach((key, index) => {
      const previous = previousEnv[index]
      if (previous === undefined) Deno.env.delete(key)
      else Deno.env.set(key, previous)
    })
  }
})
