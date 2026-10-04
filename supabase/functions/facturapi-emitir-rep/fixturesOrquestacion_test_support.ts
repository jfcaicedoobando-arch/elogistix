/** Sólo I/O en memoria para el caso de uso real (sin SDK ni DB remotos). */
interface Options { summary?: "divergent" | "unavailable"; claimTaken?: boolean; pending?: boolean; persistenceFails?: boolean }
type Row = Record<string, unknown>;

export function fixtureRep(options: Options = {}) {
  const events: string[] = [];
  const patches: Row[] = [];
  const payloads: Row[] = [];
  const pago: Row = {
    id: "pago-1", factura_id: "factura-1", organization_id: "org-1",
    monto: 680, monto_aplicado_factura: 680, moneda: "MXN", tipo_cambio: 1,
    fecha_pago: "2026-10-03", forma_pago: "03", estado_rep: "Pendiente",
    uuid_rep: null, facturapi_rep_id: null,
  };
  const tables: Record<string, Row[]> = {
    pagos_factura: [pago], user_roles: [], organization_members: [{ role: "contador" }],
    facturas: [{ id: "factura-1", cliente_id: "cliente-1", total: 1360, subtotal: 1200, iva: 160,
      moneda: "MXN", tipo_cambio: 1, metodo_pago: "PPD", facturapi_id: "factura-remota-1",
      uuid_fiscal: "11111111-2222-4333-8444-555555555555", rfc_cliente: "XAXX010101000" }],
    clientes: [{ id: "cliente-1", nombre: "LOGÍSTICA MONTERREY SA DE CV", rfc: "XAXX010101000", codigo_postal: "64000", regimen_fiscal: "601" }],
    conceptos_factura: [
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 1000 },
      { tipo_iva: "no_objeto", tasa_iva_aplicada: null, total: 200 },
    ],
    contactos_cliente: [], factura_notas_credito: [],
  };
  function query(table: string) {
    let patch: Row | undefined;
    let inserted = false;
    const resolve = (one = false) => {
      if (patch) {
        const claim = String(patch.facturapi_rep_id ?? "").startsWith("PENDING:");
        const persist = patch.estado_rep === "Timbrado";
        events.push(claim ? "claim" : persist ? "persist" : "pending");
        if (claim && options.claimTaken) return Promise.resolve({ data: null, error: null });
        if (persist && options.persistenceFails) return Promise.resolve({ data: null, error: { message: "fixture DB failure" } });
        patches.push(patch);
        Object.assign(pago, patch);
        return Promise.resolve({ data: { id: pago.id }, error: null });
      }
      const rows = tables[table] ?? [];
      return Promise.resolve({ data: inserted ? null : one ? rows[0] ?? null : rows.map(row => ({ ...row })), error: null });
    };
    const q: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "not", "order", "limit", "in"]) q[method] = () => q;
    q.update = (value: Row) => { patch = value; return q; };
    q.insert = () => { inserted = true; return q; };
    q.maybeSingle = () => resolve(true);
    q.single = () => resolve(true);
    q.then = (ok: (value: unknown) => unknown, fail: (error: unknown) => unknown) => resolve().then(ok, fail);
    return q;
  }
  const supabase = {
    from: query,
    storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }) }) },
  };
  const client = { invoices: {
    paymentSummary: async (id: string, params: { amount: number }) => {
      events.push("summary");
      if (id !== "factura-remota-1" || params.amount !== 680) throw new Error("identity / amount mismatch");
      if (options.summary === "unavailable") throw new Error("fixture provider unavailable");
      return { installment: 1, last_balance: options.summary === "divergent" ? 1 : 1360, amount: 680,
        currency: "MXN", taxes: [{ type: "IVA", rate: 0.16, base: 500 }] };
    },
    create: async (payload: Row) => {
      events.push("create"); payloads.push(payload);
      return { id: "rep-remoto-1", uuid: options.pending ? null : "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        status: options.pending ? "pending" : "valid", folio_number: 19, series: "REP" };
    },
  } };
  return { supabase, client, pago, events, patches, payloads };
}
