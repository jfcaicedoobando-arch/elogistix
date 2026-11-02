import assert from 'node:assert/strict';

export const FACTURA_A = '11111111-1111-1111-1111-111111111111';
export const FACTURA_B = '22222222-2222-2222-2222-222222222222';
export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

export function fixtureTables(): Tables {
  return {
    facturas: [
      { id: FACTURA_A, organization_id: 'org-a', cliente_id: 'cliente-a', numero: 'QA-A', total: 100, moneda: 'MXN' },
      { id: FACTURA_B, organization_id: 'org-b', cliente_id: 'cliente-b', numero: 'QA-B', total: 100, moneda: 'MXN' },
    ],
    clientes: [
      { id: 'cliente-a', organization_id: 'org-a', email: 'principal-a@example.test', deleted_at: null },
      { id: 'cliente-b', organization_id: 'org-b', email: 'principal-b@example.test', deleted_at: null },
    ],
    contactos_cliente: [
      { id: 'contacto-a', cliente_id: 'cliente-a', organization_id: 'org-a', email: 'anterior-a@example.test', created_at: '2026-01-01', deleted_at: null },
      { id: 'contacto-a2', cliente_id: 'cliente-a', organization_id: 'org-a', email: 'reciente-a@example.test', created_at: '2026-02-01', deleted_at: null },
      { id: 'contacto-b', cliente_id: 'cliente-b', organization_id: 'org-b', email: 'ajeno-b@example.test', created_at: '2025-01-01', deleted_at: null },
    ],
    user_roles: [],
    organization_members: [{ id: 'm-a', user_id: 'user-a', organization_id: 'org-a', role: 'contador' }],
  };
}

export function request(facturaId = FACTURA_A, contactoEmail?: string, token = 'token-a') {
  return new Request('https://example.test/functions/v1/recordatorio', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'https://librecarga.com' },
    body: JSON.stringify({ factura_id: facturaId, contacto_email: contactoEmail }),
  });
}

/** SDK y middleware reales, sólo transporte HTTP ficticio; prohíbe toda escritura. */
export async function withFixtureTransport(run: (state: {
  tables: Tables;
  tokens: Record<string, string | null>;
  calls: { path: string; method: string; query: string }[];
  load: (relative: string) => Promise<(req: Request) => Promise<Response>>;
}) => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalTimeout = globalThis.setTimeout;
  const originalInterval = globalThis.setInterval;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  // createClient inicia auto-refresh: recoger sus timers sin desactivar sanitizers.
  globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
    const id = originalTimeout(...args); timeouts.add(id); return id;
  }) as typeof setTimeout;
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
    const id = originalInterval(...args); intervals.add(id); return id;
  }) as typeof setInterval;
  const originalEnv = Object.getOwnPropertyDescriptor(Deno, 'env')!;
  const originalServe = Object.getOwnPropertyDescriptor(Deno, 'serve')!;
  const tables = fixtureTables();
  const tokens: Record<string, string | null> = { 'token-a': 'user-a', 'token-b': 'user-b' };
  const calls: { path: string; method: string; query: string }[] = [];
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://h21-guard-fixture.example.test', SUPABASE_ANON_KEY: 'synthetic-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service',
  };
  Object.defineProperty(Deno, 'env', { ...originalEnv, value: { get: (key: string) => env[key] } });
  globalThis.fetch = (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    assert.equal(url.origin, env.SUPABASE_URL, 'No se permite red externa');
    calls.push({ path: url.pathname, method: req.method, query: url.search });
    const json = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), {
      status, headers: { 'Content-Type': 'application/json' },
    }));
    if (url.pathname === '/auth/v1/user') {
      const user = tokens[(req.headers.get('authorization') ?? '').replace('Bearer ', '')];
      return user ? json({ id: user, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' })
        : json({ message: 'Invalid token', code: 'bad_jwt' }, 401);
    }
    if (url.pathname === '/rest/v1/rpc/saldo_factura') return json(100);
    assert.equal(req.method, 'GET', 'No se permiten escrituras ni correos');
    assert.ok(url.pathname.startsWith('/rest/v1/'), 'Destino inesperado');
    const table = url.pathname.slice('/rest/v1/'.length);
    assert.ok(table in tables, `Tabla no prevista: ${table}`);
    let rows = tables[table].map(row => ({ ...row }));
    for (const [column, filter] of url.searchParams) {
      if (filter.startsWith('eq.')) rows = rows.filter(row => String(row[column]) === filter.slice(3));
      else if (filter.startsWith('in.(')) {
        const values = filter.slice(4, -1).split(',');
        rows = rows.filter(row => values.includes(String(row[column])));
      } else if (filter === 'not.is.null') rows = rows.filter(row => row[column] !== null);
      else if (filter === 'is.null') rows = rows.filter(row => row[column] === null);
    }
    const order = url.searchParams.get('order');
    if (order) {
      const [column, direction] = order.split('.');
      rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (direction === 'desc' ? -1 : 1));
    }
    const limit = url.searchParams.get('limit');
    if (limit) rows = rows.slice(0, Number(limit));
    return json(req.headers.get('accept')?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows);
  };
  try {
    await run({ tables, tokens, calls, load: async (relative) => {
      let handler: ((req: Request) => Promise<Response>) | undefined;
      Object.defineProperty(Deno, 'serve', { configurable: true, writable: true,
        enumerable: originalServe.enumerable, value: (fn: typeof handler) => { handler = fn; } });
      await import(new URL(`${relative}?guard=${crypto.randomUUID()}`, import.meta.url).href);
      assert.ok(handler, 'El adaptador no registró handler');
      return handler;
    } });
  } finally {
    await new Promise(resolve => originalTimeout(resolve, 0));
    for (const id of intervals) clearInterval(id);
    for (const id of timeouts) clearTimeout(id);
    globalThis.setTimeout = originalTimeout;
    globalThis.setInterval = originalInterval;
    globalThis.fetch = originalFetch;
    Object.defineProperty(Deno, 'env', originalEnv);
    Object.defineProperty(Deno, 'serve', originalServe);
  }
}
