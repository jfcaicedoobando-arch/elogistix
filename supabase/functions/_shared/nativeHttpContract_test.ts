import assert from 'node:assert/strict';

Deno.test({
  name: 'Native HTTP: both real handlers preserve CORS and authentication over loopback',
  permissions: { net: ['127.0.0.1'], env: true, read: true },
  async fn() {
    const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY',
      'SENTRY_DSN_EDGE', 'LOVABLE_API_KEY'];
    const previous = keys.map((key) => Deno.env.get(key));
    // Authentication fails before any business client; logging and telemetry have no credentials.
    keys.forEach((key) => Deno.env.delete(key));
    try {
      const handlers = [
        ['parse-csf', (await import('../parse-csf/handler.ts')).handler],
        ['auditoria-explicar-hallazgo', (await import('../auditoria-explicar-hallazgo/handler.ts')).handler],
      ] as const;
      for (const [name, handler] of handlers) {
        const entry = await Deno.readTextFile(new URL(`../${name}/index.ts`, import.meta.url));
        assert.ok(!entry.includes('deno.land/std@'));
        assert.ok(entry.includes('import { handler } from "./handler.ts"'));
        assert.ok(entry.includes('Deno.serve(handler)'));
        const controller = new AbortController();
        const client = Deno.createHttpClient({ poolMaxIdlePerHost: 0 });
        let listening!: (address: Deno.NetAddr) => void;
        let failed!: (error: unknown) => void;
        const ready = new Promise<Deno.NetAddr>((resolve, reject) => {
          listening = resolve;
          failed = reject;
        });
        const timeout = setTimeout(() => {
          controller.abort();
          failed(new Error(`${name}: loopback HTTP timed out`));
        }, 5000);
        const server = Deno.serve({
          hostname: '127.0.0.1', port: 0, signal: controller.signal,
          onListen: (address) => listening({ ...address, transport: 'tcp' }),
        }, handler);
        const completed = server.finished;
        completed.catch(failed);
        try {
          const address = await ready;
          const url = `http://127.0.0.1:${address.port}/`;
          for (const origin of ['https://librecarga.com', 'https://untrusted.invalid']) {
            const response = await fetch(url, { method: 'OPTIONS', headers: { origin }, client });
            assert.equal(response.status, 200);
            assert.equal(await response.text(), '');
            assert.equal(response.headers.get('access-control-allow-origin'),
              origin === 'https://librecarga.com' ? origin : 'null');
            assert.equal(response.headers.get('vary'), 'Origin');
            assert.equal(response.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS');
            assert.ok(response.headers.get('access-control-allow-headers')?.includes('authorization'));
          }
          // Repeated unauthenticated requests exercise the real server without DB, AI or email work.
          for (let request = 0; request < 2; request++) {
            const response = await fetch(url, { method: 'POST', body: '{}', client,
              headers: { origin: 'https://librecarga.com', 'content-type': 'application/json' } });
            assert.equal(response.status, 401);
            assert.deepEqual(await response.json(), { error: 'No autorizado' });
            assert.equal(response.headers.get('access-control-allow-origin'), 'https://librecarga.com');
            assert.ok(response.headers.get('content-type')?.includes('application/json'));
          }
        } finally {
          clearTimeout(timeout);
          client.close();
          controller.abort();
          await completed;
        }
      }
    } finally {
      keys.forEach((key, index) => {
        const value = previous[index];
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      });
    }
  },
});
