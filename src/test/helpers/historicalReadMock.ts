import { vi } from "vitest";

export type HistoricalRow = Record<string, unknown>;
type ReadError = { code?: string; message: string };
type ReadResult = { data: HistoricalRow | HistoricalRow[] | null; error: ReadError | null };
export interface HistoricalRead {
  table: string;
  columns: string;
  filters: { method: "eq" | "is"; column: string; value: unknown }[];
  range?: [number, number];
}

/** Synthetic server: applies predicates before pagination/projection. This does not test deployed RLS. */
export function createHistoricalReadMock() {
  const tables: Record<string, HistoricalRow[]> = {};
  const calls: HistoricalRead[] = [];
  const errors = new Map<string, ReadError>();
  const responses = new Map<string, ReadResult>();
  const delays = new Map<string, Promise<void>>();
  let visible = (_table: string, _row: HistoricalRow) => true;
  const rpc = vi.fn().mockResolvedValue({ data: "org-a", error: null });
  const from = vi.fn((table: string) => {
    const call: HistoricalRead = { table, columns: "*", filters: [] };
    calls.push(call);
    const read = async (single = false): Promise<ReadResult> => {
      await delays.get(table);
      const error = errors.get(`${table}:${call.range?.[0] ?? 0}`);
      if (error) return { data: null, error };
      // Explicit malformed-response fixtures exercise the client's post-read validation.
      if (responses.has(table)) return responses.get(table)!;
      let rows = (tables[table] ?? []).filter((row) => visible(table, row)
        && call.filters.every(({ column, value }) => row[column] === value));
      if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1);
      rows = rows.map((row) => call.columns === "*" ? { ...row }
        : Object.fromEntries(call.columns.split(",").map((key) => [key.trim(), row[key.trim()]])));
      return { data: single ? rows[0] ?? null : rows, error: null };
    };
    const builder = {
      select(columns: string) { call.columns = columns; return builder; },
      eq(column: string, value: unknown) { call.filters.push({ method: "eq", column, value }); return builder; },
      is(column: string, value: unknown) { call.filters.push({ method: "is", column, value }); return builder; },
      range(start: number, end: number) { call.range = [start, end]; return read(); },
      maybeSingle() { return read(true); },
      then(resolve: (value: ReadResult) => unknown, reject?: (reason: unknown) => unknown) {
        return read().then(resolve, reject);
      },
    };
    return builder;
  });
  return {
    supabase: { from, rpc }, tables, calls, errors, responses, delays,
    setVisible(predicate: typeof visible) { visible = predicate; },
  };
}
