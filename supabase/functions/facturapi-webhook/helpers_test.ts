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

Deno.test("mapEventToReceiptPatch: receipt.status_updated valid", () => {
  const r = mapEventToReceiptPatch({
    type: "receipt.status_updated",
    data: { object: { id: "rep_1", status: "valid", uuid: "U-REP-1" } },
  });
  assert(r);
  assertEquals(r!.facturapi_rep_id, "rep_1");
  assertEquals(r!.patch.estado_rep, "Timbrado");
  assertEquals(r!.patch.uuid_rep, "U-REP-1");
});

Deno.test("mapEventToReceiptPatch: receipt.canceled", () => {
  const r = mapEventToReceiptPatch({
    type: "receipt.canceled",
    data: { object: { id: "rep_2" } },
  });
  assert(r);
  assertEquals(r!.patch.estado_rep, "Cancelado");
});

Deno.test("mapEventToReceiptPatch: invoice.* -> null", () => {
  assertEquals(mapEventToReceiptPatch({ type: "invoice.status_updated", data: { object: { id: "fa_1" } } }), null);
});

// ── cancellation_status_updated ─────────────────────────────────────────────
Deno.test("cancellation_status_updated: accepted -> patch con accepted (sin limpiar timestamps)", () => {
  const r = mapEventToFacturaPatch({
    type: "invoice.cancellation_status_updated",
    data: { object: { id: "fa_10", cancellation_status: "accepted" } },
  });
  assert(r);
  assertEquals(r!.patch.cancellation_status, "accepted");
  // No debe limpiar solicitada_en/vence_en; el cron lo hace al descargar acuse.
  assertEquals(r!.patch.cancelacion_solicitada_en, undefined);
});

Deno.test("cancellation_status_updated: pending -> sólo actualiza estado async", () => {
  const r = mapEventToFacturaPatch({
    type: "invoice.cancellation_status_updated",
    data: { object: { id: "fa_11", cancellation_status: "pending" } },
  });
  assertEquals(r!.patch.cancellation_status, "pending");
  assertEquals(r!.patch.estado, undefined);
});

Deno.test("cancellation_status_updated: rejected -> limpia timestamps de solicitud", () => {
  const r = mapEventToFacturaPatch({
    type: "invoice.cancellation_status_updated",
    data: { object: { id: "fa_12", cancellation_status: "rejected" } },
  });
  assertEquals(r!.patch.cancellation_status, "rejected");
  assertEquals(r!.patch.cancelacion_solicitada_en, null);
  assertEquals(r!.patch.cancelacion_vence_en, null);
});

Deno.test("cancellation_status_updated: expired -> limpia timestamps", () => {
  const r = mapEventToFacturaPatch({
    type: "invoice.cancellation_status_updated",
    data: { object: { id: "fa_13", cancellation_status: "expired" } },
  });
  assertEquals(r!.patch.cancellation_status, "expired");
  assertEquals(r!.patch.cancelacion_solicitada_en, null);
});

Deno.test("cancellation_status_updated: sin cancellation_status -> null", () => {
  assertEquals(
    mapEventToFacturaPatch({
      type: "invoice.cancellation_status_updated",
      data: { object: { id: "fa_14" } },
    }),
    null,
  );
});

// ── preserva_sustituida ─────────────────────────────────────────────────────
Deno.test("status_updated canceled marca preserva_sustituida=true", () => {
  const r = mapEventToFacturaPatch({
    type: "invoice.status_updated",
    data: { object: { id: "fa_20", status: "canceled" } },
  });
  assertEquals(r!.preserva_sustituida, true);
});

Deno.test("status_updated valid NO marca preserva_sustituida", () => {
  const r = mapEventToFacturaPatch({
    type: "invoice.status_updated",
    data: { object: { id: "fa_21", status: "valid" } },
  });
  assertEquals(r!.preserva_sustituida, false);
});

Deno.test("invoice.canceled marca preserva_sustituida=true", () => {
  const r = mapEventToFacturaPatch({
    type: "invoice.canceled",
    data: { object: { id: "fa_22" } },
  });
  assertEquals(r!.preserva_sustituida, true);
});
