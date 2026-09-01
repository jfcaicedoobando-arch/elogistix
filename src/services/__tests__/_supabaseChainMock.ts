/**
 * Helper para mockear `supabase.from(...).select().eq()...` en tests Vitest.
 *
 * **Fuente única de verdad (v13.513.0 — consolidación).** El antiguo shim
 * `src/test/utils/_supabaseChainMock.ts` fue eliminado; todos los tests
 * importan directamente desde aquí.
 *
 * APIs disponibles:

 * - `createSupabaseMock()` — completa, con `setTableResult`/`setRpcResult`,
 *   captura de llamadas, payloads de mutación. **Preferida**.
 * - `createSupabaseChainMock(data, error)` — wrapper retrocompatible para los
 *   tests legacy que esperan un único resultado por mock.
 */
import { vi } from "vitest";

export interface QueryResult<T = unknown> { data: T; error: unknown }

type Resp = QueryResult<unknown>;

export interface TableCall {
  table: string;
  ops: string[];
  /** Argumentos por operación. `opArgs[i]` corresponde a `ops[i]`. */
  opArgs: unknown[][];
}

export function createSupabaseMock() {
  const tableResults = new Map<string, Resp>();
  const rpcResults = new Map<string, Resp>();
  const tableCalls: TableCall[] = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];

  function setTableResult(table: string, res: Resp) { tableResults.set(table, res); }
  function setRpcResult(fn: string, res: Resp) { rpcResults.set(fn, res); }
  function resetResults() {
    tableResults.clear();
    rpcResults.clear();
  }

  function makeChain(table: string, ops: string[], opArgs: unknown[][]) {
    const res = tableResults.get(table) ?? { data: [], error: null };
    const chain: Record<string, unknown> = {};
    const passthrough = (label: string) => (...args: unknown[]) => {
      ops.push(label);
      opArgs.push(args);
      return chain;
    };
    chain.select = passthrough("select");
    chain.insert = passthrough("insert");
    chain.update = passthrough("update");
    chain.delete = passthrough("delete");
    chain.upsert = passthrough("upsert");
    chain.eq = passthrough("eq");
    chain.neq = passthrough("neq");
    chain.in = passthrough("in");
    chain.gte = passthrough("gte");
    chain.lte = passthrough("lte");
    chain.gt = passthrough("gt");
    chain.lt = passthrough("lt");
    chain.not = passthrough("not");
    chain.is = passthrough("is");
    chain.like = passthrough("like");
    chain.ilike = passthrough("ilike");
    chain.contains = passthrough("contains");
    chain.or = passthrough("or");
    chain.match = passthrough("match");
    chain.order = passthrough("order");
    chain.limit = passthrough("limit");
    chain.range = passthrough("range");
    chain.maybeSingle = () => Promise.resolve(res);
    chain.single = () => Promise.resolve(res);
    chain.then = (onFulfilled: (r: Resp) => unknown) => Promise.resolve(res).then(onFulfilled);
    return chain;
  }

  const supabase = {
    from: vi.fn((table: string) => {
      const ops: string[] = [];
      const opArgs: unknown[][] = [];
      tableCalls.push({ table, ops, opArgs });
      return makeChain(table, ops, opArgs);
    }),
    rpc: vi.fn((fn: string, args?: unknown) => {
      rpcCalls.push({ fn, args });
      const res = rpcResults.get(fn) ?? { data: null, error: null };
      return Promise.resolve(res);
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    // v13.821.2 — Varios servicios sellan `user_id` leyendo la sesión; sin
    // esto los tests fallaban con "Cannot read properties of undefined
    // (reading 'getUser')" en vez de probar la regla de negocio.
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "u1" }, access_token: "t" } },
        error: null,
      }),
    },

  };

  /**
   * Extrae el primer payload de `insert`/`update`/`upsert` para una tabla.
   * Devuelve `null` si no se encontró.
   */
  function getMutationPayload(
    table: string,
    op: "insert" | "update" | "upsert" = "insert",
  ): unknown {
    for (const call of tableCalls) {
      if (call.table !== table) continue;
      const idx = call.ops.indexOf(op);
      if (idx >= 0) return call.opArgs[idx]?.[0] ?? null;
    }
    return null;
  }

  return { supabase, setTableResult, setRpcResult, resetResults, tableCalls, rpcCalls, getMutationPayload };
}

/**
 * Wrapper retrocompatible: devuelve un mock thenable que responde con
 * `{ data, error }` a cualquier cadena. Útil cuando el test sólo necesita
 * un único resultado y no le importa qué tabla/operación se invocó.
 *
 * Para tests nuevos, preferir `createSupabaseMock()`.
 */
export const createSupabaseChainMock = (data: unknown = [], error: unknown = null) => {
  const single = (): Promise<Resp> =>
    Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error });
  const maybeSingle = (): Promise<Resp> =>
    Promise.resolve({
      data: Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data,
      error,
    });
  const mock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(single),
    maybeSingle: vi.fn().mockImplementation(maybeSingle),
    then: vi.fn().mockImplementation((onfulfilled) =>
      Promise.resolve({ data, error }).then(onfulfilled),
    ),
    rpc: vi.fn().mockReturnThis(),
  };
  return mock;
};
