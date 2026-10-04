/** Caso de uso REAL: sólo I/O externo es doble; jamás copiar la orquestación. */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { emitirRepCasoUso, type ArgsCasoUsoRep } from "./casoUso.ts";
import { fixtureRep } from "./fixturesOrquestacion_test_support.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function execute(options: Parameters<typeof fixtureRep>[0] = {}) {
  const fixture = fixtureRep(options);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    fixture.events.push("xml");
    return Promise.resolve(new Response("<xml/>", { status: 200 }));
  };
  try {
    const response = await emitirRepCasoUso({
      supabase: fixture.supabase as unknown as ArgsCasoUsoRep["supabase"],
      pagoId: "pago-1", usuario: { id: "usuario-1" }, json,
      resolverFacturapi: async org => {
        assertEquals(org, "org-1");
        return { ok: true, data: { client: fixture.client, apiKey: "sk_test_mock", ambiente: "sandbox" } };
      },
    });
    return { ...fixture, response, body: await response.json() };
  } finally { globalThis.fetch = originalFetch; }
}

for (const summary of ["divergent", "unavailable"] as const) {
  Deno.test(`orquestación REP: resumen ${summary} impide claim Y emisión`, async () => {
    const r = await execute({ summary });
    assertEquals(r.response.status, summary === "divergent" ? 422 : 503);
    assertEquals(r.events, ["summary"]);
    assertEquals(r.payloads.length, 0);
    assertEquals(r.patches.length, 0);
  });
}

Deno.test("orquestación REP: claim ocupado corta antes de create", async () => {
  const r = await execute({ claimTaken: true });
  assertEquals(r.response.status, 409);
  assertEquals(r.events, ["summary", "claim"]);
  assertEquals(r.payloads.length, 0);
});

Deno.test("orquestación REP: pending conserva correlación, sin XML ni Timbrado", async () => {
  const r = await execute({ pending: true });
  assertEquals(r.response.status, 202);
  assertEquals(r.events, ["summary", "claim", "create", "pending"]);
  assertEquals(r.payloads.length, 1);
  assert(String(r.payloads[0].idempotency_key).startsWith("PENDING:"));
  assertEquals(r.payloads[0].idempotency_key, r.payloads[0].external_id);
  assertEquals(r.pago.facturapi_rep_id, r.payloads[0].idempotency_key);
  assertEquals(r.pago.facturapi_rep_pendiente_id, "rep-remoto-1");
  assertEquals(r.patches.some(p => p.estado_rep === "Timbrado" || p.uuid_rep), false);
});

Deno.test("orquestación REP: éxito valida→claim→create→respaldo→persistencia", async () => {
  const r = await execute();
  assertEquals(r.response.status, 200);
  assertEquals(r.events, ["summary", "claim", "create", "xml", "persist"]);
  assertEquals(r.payloads.length, 1);
  assertEquals(r.body.uuid, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  assertEquals(r.pago.estado_rep, "Timbrado");
  assertEquals(r.pago.facturapi_rep_id, "rep-remoto-1");
});

Deno.test("orquestación REP: falla al persistir no libera claim ni vuelve a emitir", async () => {
  const r = await execute({ persistenceFails: true });
  assertEquals(r.response.status, 500);
  assertEquals(r.body.error, "db_update_failed");
  assertEquals(r.payloads.length, 1);
  assertEquals(r.pago.facturapi_rep_id, r.payloads[0].idempotency_key);
  assertEquals(r.pago.uuid_rep, null);
  assertEquals(r.patches.some(p => p.facturapi_rep_id === null), false);
});
