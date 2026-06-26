import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeSignature, mapEventToFacturaPatch, mapEventToReceiptPatch, safeEqual } from "./helpers.ts";

Deno.test("safeEqual: igualdad y desigualdad", () => {
  assert(safeEqual("abc", "abc"));
  assert(!safeEqual("abc", "abd"));
  assert(!safeEqual("abc", "abcd"));
});

Deno.test("computeSignature: HMAC-SHA256 hex determinista", async () => {
  const sig = await computeSignature("hello", "secret");
  assertEquals(sig, "88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b");
});

Deno.test("mapEventToFacturaPatch: status_updated canceled", () => {
  const r = mapEventToFacturaPatch({
    type: "invoice.status_updated",
    data: { object: { id: "fa_1", status: "canceled", uuid: "U-1" } },
  });
  assert(r);
  assertEquals(r!.facturapi_id, "fa_1");
  assertEquals(r!.patch.estado, "Cancelada");
  assertEquals(r!.patch.uuid_fiscal, "U-1");
});

Deno.test("mapEventToFacturaPatch: status_updated valid", () => {
  const r = mapEventToFacturaPatch({
    type: "invoice.status_updated",
    data: { object: { id: "fa_2", status: "valid", uuid: "U-2" } },
  });
  assertEquals(r!.patch.estado, "Timbrada");
});

Deno.test("mapEventToFacturaPatch: delivered_to_customer", () => {
  const r = mapEventToFacturaPatch({
    type: "invoice.delivered_to_customer",
    data: { object: { id: "fa_3" } },
  });
  assert(typeof r!.patch.enviada_cliente_at === "string");
});

Deno.test("mapEventToFacturaPatch: tipo desconocido -> null", () => {
  assertEquals(mapEventToFacturaPatch({ type: "other", data: { object: { id: "x" } } }), null);
});

Deno.test("mapEventToFacturaPatch: sin object -> null", () => {
  assertEquals(mapEventToFacturaPatch({ type: "invoice.canceled" }), null);
});
