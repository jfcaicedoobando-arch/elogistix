import { assertEquals, assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeEventKey, computeSignature, mapEventToFacturaPatch, mapEventToReceiptPatch, safeEqual } from "./helpers.ts";

Deno.test("computeEventKey: usa event.id cuando existe", async () => {
  const key = await computeEventKey('{"id":"evt_abc","type":"invoice.status_updated"}', {
    type: "invoice.status_updated",
    ...({ id: "evt_abc" } as Record<string, unknown>),
  });
  assertEquals(key, "evt_abc");
});

Deno.test("computeEventKey: fallback sha256 cuando falta id, determinista", async () => {
  const body = '{"type":"invoice.status_updated","data":{"object":{"id":"fa_x"}}}';
  const k1 = await computeEventKey(body, { type: "invoice.status_updated" });
  const k2 = await computeEventKey(body, { type: "invoice.status_updated" });
  assertEquals(k1, k2);
  assert(k1.startsWith("sha256:"));
  assertEquals(k1.length, 7 + 64);
});

Deno.test("computeEventKey: bodies distintos producen claves distintas", async () => {
  const a = await computeEventKey('{"a":1}', { type: "x" });
  const b = await computeEventKey('{"a":2}', { type: "x" });
  assert(a !== b);
});

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
  // Ola 4 · N3: el enum estado_factura no tiene 'Timbrada'; el valor válido
  // es 'Emitida' (igual que el timbrado local).
  assertEquals(r!.patch.estado, "Emitida");
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

Deno.test("cancellation_status_updated: accepted también fija estado y preserva_sustituida (Ola 4 · N18)", () => {
  const r = mapEventToFacturaPatch({
    type: "invoice.cancellation_status_updated",
    data: { object: { id: "fa_10", cancellation_status: "accepted" } },
  });
  assert(r);
  assertEquals(r!.patch.estado, "Cancelada");
  assertEquals(typeof r!.patch.cancelado_en, "string");
  assertEquals(r!.preserva_sustituida, true);
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

// ── Ola 4 · N2/N3: invariantes estructurales del orden de dedupe en index.ts ──
// El dedupe (`facturapi_webhook_eventos`) debe insertarse SÓLO después de
// procesar el evento con éxito; si el handler falla (5xx) no se registra,
// para que los reintentos de FacturAPI puedan reprocesar el evento.
const webhookIndexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("index.ts: el insert de dedupe ocurre DESPUÉS de procesar el evento, no antes", () => {
  const idxProcesar = webhookIndexSource.indexOf("await handleReceiptEvent(supabase, orgId, event, receipt)");
  const idxDedupeCheck = webhookIndexSource.indexOf('.eq("event_id", eventKey)');
  const idxDedupeInsert = webhookIndexSource.indexOf('.insert({\n      organization_id: orgId,\n      event_id: eventKey,');
  assert(idxDedupeCheck >= 0 && idxProcesar >= 0 && idxDedupeInsert >= 0, "deben existir las tres etapas");
  // El chequeo de duplicado va antes de procesar; el insert va después.
  assert(idxDedupeCheck < idxProcesar, "el chequeo de dedupe debe ser previo al procesamiento");
  assert(idxProcesar < idxDedupeInsert, "el insert de dedupe debe ser posterior al procesamiento");
});

Deno.test("index.ts: si el procesamiento falla (result.ok=false) se retorna ANTES de insertar el dedupe", () => {
  assertStringIncludes(webhookIndexSource, "if (!result.ok) return result;");
  const idxGuard = webhookIndexSource.indexOf("if (!result.ok) return result;");
  const idxInsert = webhookIndexSource.indexOf('.insert({\n      organization_id: orgId,\n      event_id: eventKey,');
  assert(idxGuard >= 0 && idxInsert >= 0 && idxGuard < idxInsert);
});

Deno.test("index.ts: 'Emitida' es el único estado usado para invoice.status_updated valid (nunca 'Timbrada')", () => {
  assert(!webhookIndexSource.includes('"Timbrada"'), "index.ts no debe usar el literal 'Timbrada'");
});
