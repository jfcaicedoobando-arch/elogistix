import { createSupabaseMock, type QueryResult } from "./_supabaseChainMock";

/** Cada from consume una respuesta propia; sólo emula el filtro deleted_at. */
export function createSoftDeleteReadMock() {
  const mock = createSupabaseMock();
  const from = mock.supabase.from.getMockImplementation()!;
  const plans: Array<QueryResult & { table: string }> = [];
  const queue = (table: string, data: unknown, error: unknown = null) => {
    plans.push({ table, data, error });
  };
  mock.supabase.from.mockImplementation((table: string) => {
    const plan = plans.shift();
    if (!plan || plan.table !== table) throw new Error(`Consulta inesperada: ${table}; esperada: ${plan?.table ?? "ninguna"}`);
    const chain = from(table);
    const call = mock.tableCalls.at(-1)!;
    const response = () => {
      const filtraBorrados = call.ops.some((op, i) => op === "is"
        && call.opArgs[i][0] === "deleted_at" && call.opArgs[i][1] === null);
      const vivo = (row: unknown) => row == null || typeof row !== "object"
        || !("deleted_at" in row) || row.deleted_at == null;
      const data = !filtraBorrados ? plan.data : Array.isArray(plan.data)
        ? plan.data.filter(vivo) : vivo(plan.data) ? plan.data : null;
      return { data, error: plan.error };
    };
    chain.maybeSingle = () => Promise.resolve(response());
    chain.single = () => Promise.resolve(response());
    chain.then = (onFulfilled: (res: QueryResult) => unknown) => Promise.resolve(response()).then(onFulfilled);
    return chain;
  });
  return {
    ...mock,
    queue,
    reset: () => {
      plans.length = 0;
      mock.resetResults();
      mock.tableCalls.length = 0;
      mock.rpcCalls.length = 0;
    },
  };
}
