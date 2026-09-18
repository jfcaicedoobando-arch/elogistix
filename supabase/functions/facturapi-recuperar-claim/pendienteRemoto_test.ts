/**
 * P0-A.5 / P0-C — La recuperación de un intento con timbrado PENDIENTE nunca
 * promueve ni libera el claim: FacturAPI sigue recuperando el timbre.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buscarPorIdPendiente, respuestaPendienteRemoto } from "./pendienteRemoto.ts";

const UUID = "5f9c1c2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b";

Deno.test("sin id pendiente no consulta nada (cae al barrido por external_id)", async () => {
  let llamadas = 0;
  const client = { invoices: { retrieve: () => { llamadas++; return Promise.resolve({}); } } };
  assertEquals(await buscarPorIdPendiente(client, null), null);
  assertEquals(llamadas, 0);
});

Deno.test("un remoto valid con UUID se promueve", async () => {
  const client = {
    invoices: { retrieve: (id: string) => Promise.resolve({ id, uuid: UUID, status: "valid" }) },
  };
  const r = await buscarPorIdPendiente(client, "inv_1");
  assertEquals(r?.kind, "encontrado");
});

Deno.test("un remoto pending (o sin UUID) se reporta pendiente, no encontrado", async () => {
  for (const remoto of [{ id: "inv_1", status: "pending" }, { id: "inv_1", status: "valid" }]) {
    const client = { invoices: { retrieve: () => Promise.resolve(remoto) } };
    const r = await buscarPorIdPendiente(client, "inv_1");
    assertEquals(r?.kind, "pendiente_remoto");
  }
});

Deno.test("un error remoto devuelve null para caer al barrido, sin liberar nada", async () => {
  const client = { invoices: { retrieve: () => Promise.reject(new Error("502")) } };
  assertEquals(await buscarPorIdPendiente(client, "inv_1"), null);
});

Deno.test("la respuesta pendiente es 409, no reintentable y no libera el claim", async () => {
  const res = respuestaPendienteRemoto({ id: "inv_1", status: "pending" }, "PENDING:abc");
  assertEquals(res.status, 409);
  const body = await res.json();
  assertEquals(body.outcome, "timbrado_pendiente");
  assertEquals(body.pendiente, true);
  assertEquals(body.reintentable, false);
  assertEquals(body.facturapi_pendiente_id, "inv_1");
  assertEquals(body.external_id, "PENDING:abc");
  assert(body.outcome !== "liberado");
});
