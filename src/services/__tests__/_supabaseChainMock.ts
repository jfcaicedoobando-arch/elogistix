/**
 * Helper para mockear `supabase.from(...).select().eq()...` en tests Vitest.
 *
 * Cada `from(table)` devuelve un thenable encadenable. Configurar las
 * respuestas por tabla con `setTableResult(table, { data, error })`.
 *
 * Para mockear RPCs usar `setRpcResult(fnName, { data, error })`.
 *
 * 12.61.20 (Sprint 4): cada `TableCall` ahora expone `opArgs[i]` con los
 * argumentos pasados a la operación, y `getMutationPayload(table, op)` para
 * extraer el payload de `insert`/`update`/`upsert`.
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
      })),
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

  return { supabase, setTableResult, setRpcResult, tableCalls, rpcCalls, getMutationPayload };
}
