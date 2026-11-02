import assert from 'node:assert/strict';
import type { DestinatarioConfirmado } from '../_shared/recordatorioDestinatario.ts';

export const FACTURA_A = '11111111-1111-1111-1111-111111111111';
export const FACTURA_B = '22222222-2222-2222-2222-222222222222';
export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

function selectRows(source: Row[], url: URL): Row[] {
  let rows = source.map(row => ({ ...row }));
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
  return limit ? rows.slice(0, Number(limit)) : rows;
}

export function fixtureTables(): Tables {
  return {
    facturas: [
      { id: FACTURA_A, organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', cliente_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', numero: 'QA-A', total: 100, moneda: 'MXN' },
      { id: FACTURA_B, organization_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', cliente_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', numero: 'QA-B', total: 100, moneda: 'MXN' },
    ],
    clientes: [
      { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'principal-a@example.test', deleted_at: null },
      { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', organization_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', email: 'principal-b@example.test', deleted_at: null },
    ],
    contactos_cliente: [
      { id: '33333333-3333-3333-3333-333333333333', cliente_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'anterior-a@example.test', created_at: '2026-01-01', deleted_at: null },
      { id: '44444444-4444-4444-4444-444444444444', cliente_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'reciente-a@example.test', created_at: '2026-02-01', deleted_at: null },
      { id: '55555555-5555-5555-5555-555555555555', cliente_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', organization_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', email: 'ajeno-b@example.test', created_at: '2025-01-01', deleted_at: null },
    ],
    user_roles: [],
    profiles: [{ id: 'user-a', nombre: 'Ejecutivo ficticio', email: 'ejecutivo@example.test', telefono: '' }],
    organizations: [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', nombre: 'Empresa ficticia' }],
    organization_members: [{ id: 'm-a', user_id: 'user-a', organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role: 'contador' }],
  };
}

export function request(facturaId = FACTURA_A, confirmado?: DestinatarioConfirmado, token = 'token-a') {
  return new Request('https://example.test/functions/v1/recordatorio', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'https://librecarga.com' },
    body: JSON.stringify({ factura_id: facturaId, confirmacion_version: 2, destinatario_confirmado: confirmado }),
  });
}

/** SDK, middleware, plantilla y transporte reales, con HTTP local ficticio y sin red. */
export async function withFixtureTransport(run: (state: {
  tables: Tables;
  tokens: Record<string, string | null>;
  calls: { path: string; method: string; query: string }[];
  delivery: { enabled: boolean; status: number; historyStatus: number; emails: Row[]; history: Row[]; logs: Row[] };
  controls: { beforeRead?: (table: string) => void };
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
  const delivery = { enabled: false, status: 200, historyStatus: 201,
    emails: [] as Row[], history: [] as Row[], logs: [] as Row[] };
  const controls: { beforeRead?: (table: string) => void } = {};
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://h21-guard-fixture.example.test', SUPABASE_ANON_KEY: 'synthetic-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service',
    LOVABLE_API_KEY: 'synthetic-email-key',
    LOVABLE_SEND_URL: 'https://h21-guard-fixture.example.test/fixture-mail',
  };
  Object.defineProperty(Deno, 'env', { ...originalEnv, value: { get: (key: string) => env[key] } });
  globalThis.fetch = async (input, init) => {
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
    if (delivery.enabled && req.method === 'POST') {
      const body = await req.json();
      if (url.pathname === '/fixture-mail') {
        delivery.emails.push(body);
        return delivery.status === 200 ? json({ id: 'offline-message' })
          : json({ error: { message: 'Fallo ficticio de transporte', code: 'invalid_request' } }, delivery.status);
      }
      if (url.pathname === '/rest/v1/rpc/email_send_log_touch') {
        delivery.logs.push(body); return json(true);
      }
      if (url.pathname === '/rest/v1/factura_recordatorios') {
        delivery.history.push(body);
        return delivery.historyStatus === 201 ? json([], 201)
          : json({ message: 'Historial ficticio no disponible', code: 'fixture_failure' }, delivery.historyStatus);
      }
    }
    assert.equal(req.method, 'GET', 'No se permiten escrituras ni correos');
    assert.ok(url.pathname.startsWith('/rest/v1/'), 'Destino inesperado');
    const table = url.pathname.slice('/rest/v1/'.length);
    assert.ok(table in tables, `Tabla no prevista: ${table}`);
    controls.beforeRead?.(table);
    const rows = selectRows(tables[table], url);
    return json(req.headers.get('accept')?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows);
  };
  try {
    await run({ tables, tokens, calls, delivery, controls, load: async (relative) => {
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
