/**
 * Helper para mockear `supabase.from(...).select().eq()...` en tests Vitest.
 *
 * Cada `from(table)` devuelve un thenable encadenable. Configurar las
 * respuestas por tabla con `setTableResult(table, { data, error })`.
 *
 * Para mockear RPCs usar `setRpcResult(fnName, { data, error })`.
 */
import { vi } from "vitest";

export interface QueryResult<T = unknown> { data: T; error: unknown }

type Resp = QueryResult<unknown>;

export function createSupabaseMock() {
  const tableResults = new Map<string, Resp>();
  const rpcResults = new Map<string, Resp>();
  const tableCalls: Array<{ table: string; ops: string[] }> = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];

  function setTableResult(table: string, res: Resp) { tableResults.set(table, res); }
  function setRpcResult(fn: string, res: Resp) { rpcResults.set(fn, res); }

  function makeChain(table: string, ops: string[]) {
    const res = tableResults.get(table) ?? { data: [], error: null };
    const chain: Record<string, unknown> = {};
    const passthrough = (label: string) => (..._args: unknown[]) => {
      ops.push(label);
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
      tableCalls.push({ table, ops });
      return makeChain(table, ops);
    }),
    rpc: vi.fn((fn: string, args?: unknown) => {
      rpcCalls.push({ fn, args });
      const res = rpcResults.get(fn) ?? { data: null, error: null };
      return Promise.resolve(res);
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  };

  return { supabase, setTableResult, setRpcResult, tableCalls, rpcCalls };
}
