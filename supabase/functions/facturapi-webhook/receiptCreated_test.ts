/**
 * P2-A · corrección P0 regresiva — `receipt.created` sin UUID fiscal válido no
 * puede marcar el REP como timbrado ni autorizar la adopción del claim.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapEventToReceiptPatch } from "./helpers.ts";
import { COLS_REP, patchAdopcionPendiente } from "./pendiente.ts";

const UUID_OK = "3f2b8a10-1c4d-4e7f-9a2b-0c1d2e3f4a5b";

function evento(object: Record<string, unknown>) {
  return { type: "receipt.created", data: { object } };
}

Deno.test("receipt.created sin uuid se ignora (el REP sigue pendiente)", () => {
  assertEquals(mapEventToReceiptPatch(evento({ id: "rep_1" })), null);
});

Deno.test("receipt.created con uuid inválido también se ignora", () => {
  assertEquals(mapEventToReceiptPatch(evento({ id: "rep_1", uuid: "" })), null);
  assertEquals(mapEventToReceiptPatch(evento({ id: "rep_1", uuid: "pendiente" })), null);
  assertEquals(mapEventToReceiptPatch(evento({ id: "rep_1", uuid: "1234" })), null);
});

Deno.test("receipt.created con uuid válido sí timbra el REP", () => {
  const mapped = mapEventToReceiptPatch(evento({ id: "rep_1", uuid: UUID_OK }));
  assert(mapped);
  assertEquals(mapped.facturapi_rep_id, "rep_1");
  assertEquals(mapped.patch.estado_rep, "Timbrado");
  assertEquals(mapped.patch.uuid_rep, UUID_OK);
  assertEquals(mapped.bitacora_accion, "facturapi_webhook_rep_created");
});

Deno.test("un patch sin uuid nunca adopta el intento pendiente (claim intacto)", () => {
  assertEquals(patchAdopcionPendiente(COLS_REP, "rep_remoto", { estado_rep: "Timbrado" }), null);
  const adopcion = patchAdopcionPendiente(COLS_REP, "rep_remoto", {
    estado_rep: "Timbrado", uuid_rep: UUID_OK,
  });
  assertEquals(adopcion, {
    facturapi_rep_id: "rep_remoto",
    facturapi_rep_claim_at: null,
    facturapi_rep_pendiente_id: null,
    facturapi_rep_pendiente_at: null,
  });
});
