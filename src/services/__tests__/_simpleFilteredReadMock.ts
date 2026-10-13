import { createSupabaseMock } from "./_supabaseChainMock";
type Row = Record<string, unknown>;
type Source = { data: Row | Row[] | null; error: unknown };

/** Modela sólo SELECT simple, eq, is y order; no reemplaza un contrato de BD. */
export function createSimpleFilteredReadMock() {
  const mock = createSupabaseMock();
  const from = mock.supabase.from.getMockImplementation()!;
  const sources = new Map<string, Source>();
  const source = (table: string, data: Source["data"], error: unknown = null) => sources.set(table, { data, error });
  mock.supabase.from.mockImplementation(table => {
    if (!sources.has(table)) throw new Error(`Falta fixture para ${table}`);
    const chain = from(table); const call = mock.tableCalls.at(-1)!;
    const response = (single: boolean) => {
      const input = sources.get(table)!;
      if (input.data === null) return { data: null, error: input.error };
      let rows = (Array.isArray(input.data) ? input.data : [input.data]).filter(row => call.ops.every((op, i) => {
        const [key, value] = call.opArgs[i];
        if (typeof key !== "string") return true;
        if (op === "eq") return row[key] === value;
        if (op === "is") return value === null ? row[key] == null : row[key] === value;
        return true;
      }));
      const order = call.ops.indexOf("order");
      if (order >= 0) {
        const key = String(call.opArgs[order][0]); const options = call.opArgs[order][1];
        const direction = options && typeof options === "object" && "ascending" in options && options.ascending === false ? -1 : 1;
        rows = [...rows].sort((a, b) => (String(a[key]) < String(b[key]) ? -1 : String(a[key]) > String(b[key]) ? 1 : 0) * direction);
      }
      const select = call.ops.indexOf("select");
      const columns = String(call.opArgs[select]?.[0] ?? "*");
      const projected = rows.map(row => columns === "*" ? { ...row }
        : Object.fromEntries(columns.split(",").map(column => column.trim()).map(key => [key, row[key]])));
      return { data: single || !Array.isArray(input.data) ? projected[0] ?? null : projected, error: input.error };
    };
    chain.maybeSingle = () => Promise.resolve(response(true));
    chain.single = () => Promise.resolve(response(true));
    chain.then = (fn: (res: { data: unknown; error: unknown }) => unknown) => Promise.resolve(response(false)).then(fn);
    return chain;
  });
  return { ...mock, source, reset: () => {
    sources.clear(); mock.resetResults(); mock.tableCalls.length = 0; mock.rpcCalls.length = 0;
  } };
}
