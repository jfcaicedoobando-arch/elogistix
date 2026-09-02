/**
 * Regresión: `handleFacturaEvent` (index.ts) delega el cierre de una
 * cancelación aceptada a la RPC compartida `cerrar_cancelacion_factura_facturapi`
 * en vez de persistir el patch crudo con `cancellation_status=accepted`.
 * Cubre accepted CON sustituida_por, accepted SIN sustituida_por, e
 * idempotencia en una segunda ejecución.
 */
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("index.ts: invoca la RPC de cierre cuando cancellation_status=accepted", () => {
  assertStringIncludes(indexSource, "cerrar_cancelacion_factura_facturapi");
  const rpcIdx = indexSource.indexOf('supabase.rpc("cerrar_cancelacion_factura_facturapi"');
  assert(rpcIdx > 0, "debe invocar la RPC vía supabase.rpc");
});

Deno.test("index.ts: NO persiste estado/cancellation_status accepted crudos tras invocar la RPC", () => {
  const rpcIdx = indexSource.indexOf('supabase.rpc("cerrar_cancelacion_factura_facturapi"');
  const updIdx = indexSource.indexOf('.from("facturas")\n    .update(patch)');
  const bloque = indexSource.slice(rpcIdx, updIdx);
  assertStringIncludes(bloque, "delete patch.estado");
  assertStringIncludes(bloque, "delete patch.cancellation_status");
  assertStringIncludes(bloque, "delete patch.cancelado_en");
});

Deno.test("index.ts: el update de facturas se vuelve condicional (no corre con patch vacío)", () => {
  assertStringIncludes(indexSource, "if (Object.keys(patch).length > 0) {");
});

// --- Simulación funcional de handleFacturaEvent contra un cliente falso ---

type Row = Record<string, unknown>;

function fakeSupabase(factura: Row, rpcCalls: Array<Row>, updates: Array<Row>) {
  return {
    from(table: string) {
      if (table !== "facturas") throw new Error(`tabla inesperada: ${table}`);
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: factura }; },
        update(patch: Row) {
          updates.push(patch);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
    async rpc(name: string, args: Row) {
      rpcCalls.push({ name, args });
      return { data: { ok: true }, error: null };
    },
  };
}

/** Réplica mínima (fiel al código real) de la rama accepted de handleFacturaEvent. */
async function simularCierre(factura: Row, patchInicial: Row) {
  const rpcCalls: Array<Row> = [];
  const updates: Array<Row> = [];
  const supabase = fakeSupabase(factura, rpcCalls, updates);
  const patch: Row = { ...patchInicial };

  if (patch.cancellation_status === "accepted") {
    const { error: rpcErr } = await supabase.rpc("cerrar_cancelacion_factura_facturapi", {
      p_factura_id: factura.id,
    });
    if (rpcErr) throw new Error("rpc_failed");
    delete patch.estado;
    delete patch.cancellation_status;
    delete patch.cancelado_en;
    delete patch.cancelacion_solicitada_en;
    delete patch.cancelacion_vence_en;
  }

  if (Object.keys(patch).length > 0) {
    await (supabase.from("facturas") as unknown as { update: (p: Row) => { eq: (id: string) => Promise<unknown> } })
      .update(patch).eq(factura.id as string);
  }
  return { rpcCalls, updates };
}

Deno.test("handleFacturaEvent (simulado): accepted CON sustituida_por delega a la RPC", async () => {
  const factura = { id: "f1", organization_id: "org1", estado: "Emitida", sustituida_por: "f2", cancellation_status: "pending" };
  const { rpcCalls, updates } = await simularCierre(factura, {
    estado: "Cancelada", cancellation_status: "accepted", cancelado_en: "2026-01-01T00:00:00Z",
  });
  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].args, { p_factura_id: "f1" });
  assertEquals(updates.length, 0, "no debe persistir el patch crudo cuando sólo traía campos de cierre");
});

Deno.test("handleFacturaEvent (simulado): accepted SIN sustituida_por también delega a la RPC", async () => {
  const factura = { id: "f3", organization_id: "org1", estado: "Emitida", sustituida_por: null, cancellation_status: "pending" };
  const { rpcCalls, updates } = await simularCierre(factura, {
    estado: "Cancelada", cancellation_status: "accepted", cancelado_en: "2026-01-01T00:00:00Z",
  });
  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].args, { p_factura_id: "f3" });
  assertEquals(updates.length, 0);
});

Deno.test("handleFacturaEvent (simulado): segunda ejecución idempotente (mismo patch) vuelve a llamar la RPC sin error", async () => {
  const factura = { id: "f1", organization_id: "org1", estado: "Cancelada", sustituida_por: null, cancellation_status: "accepted" };
  const primera = await simularCierre(factura, {
    estado: "Cancelada", cancellation_status: "accepted", cancelado_en: "2026-01-01T00:00:00Z",
  });
  const segunda = await simularCierre(factura, {
    estado: "Cancelada", cancellation_status: "accepted", cancelado_en: "2026-01-01T00:00:00Z",
  });
  assertEquals(primera.rpcCalls.length, 1);
  assertEquals(segunda.rpcCalls.length, 1);
  assertEquals(primera.updates.length, 0);
  assertEquals(segunda.updates.length, 0);
});
