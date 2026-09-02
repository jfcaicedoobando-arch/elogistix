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

// Ola 5 · RG4-10: los eventos `invoice.*` también se mapean como REP (el
// dispatcher los intenta como factura primero y cae a REP si no matchea).
Deno.test("mapEventToReceiptPatch: invoice.canceled -> patch de REP cancelado", () => {
  const r = mapEventToReceiptPatch({ type: "invoice.canceled", data: { object: { id: "fa_1" } } });
  assert(r);
  assertEquals(r!.facturapi_rep_id, "fa_1");
  assertEquals(r!.patch.estado_rep, "Cancelado");
  assertEquals(r!.patch.rep_cancellation_status, "accepted");
});

Deno.test("mapEventToReceiptPatch: cancellation_status accepted fija rep_cancellation_status", () => {
  const r = mapEventToReceiptPatch({
    type: "receipt.status_updated",
    data: { object: { id: "rep_3", cancellation_status: "accepted" } },
  });
  assert(r);
  assertEquals(r!.patch.estado_rep, "Cancelado");
  assertEquals(r!.patch.rep_cancellation_status, "accepted");
});

Deno.test("mapEventToReceiptPatch: cancellation_status pending NO cambia estado_rep", () => {
  const r = mapEventToReceiptPatch({
    type: "receipt.status_updated",
    data: { object: { id: "rep_4", cancellation_status: "pending" } },
  });
  assert(r);
  assertEquals(r!.patch.estado_rep, undefined);
  assertEquals(r!.patch.rep_cancellation_status, "pending");
});

Deno.test("mapEventToReceiptPatch: sin object -> null", () => {
  assertEquals(mapEventToReceiptPatch({ type: "receipt.canceled" }), null);
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

// ── EF-07: invariantes estructurales del dedupe ATÓMICO (INSERT-first) ──────
// El evento se reserva con un INSERT antes de procesar (23505 = duplicado);
// si el procesamiento falla se borra la reserva para que el reintento de
// FacturAPI pueda reprocesar el evento.
const webhookIndexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("index.ts: el dedupe es INSERT-first (reserva antes de procesar)", () => {
  const idxInsert = webhookIndexSource.indexOf('.from("facturapi_webhook_eventos")');
  const idxProcesar = webhookIndexSource.indexOf("await despacharEvento(supabase, orgId, event)");
  assert(idxInsert >= 0 && idxProcesar >= 0, "deben existir la reserva y el procesamiento");
  assert(idxInsert < idxProcesar, "la reserva de dedupe debe ser previa al procesamiento");
  assertStringIncludes(webhookIndexSource, '?.code === "23505"');
  assert(!webhookIndexSource.includes("registrarDedupe"), "registrarDedupe quedó sin uso (EF-07)");
});

Deno.test("index.ts: si el procesamiento falla se libera la reserva de dedupe", () => {
  assertStringIncludes(webhookIndexSource, "if (!result.ok) {");
  const idxGuard = webhookIndexSource.indexOf("if (!result.ok) {");
  const idxDelete = webhookIndexSource.indexOf(".delete()", idxGuard);
  assert(idxDelete > idxGuard, "el borrado de la reserva debe ir dentro del guard de fallo");
});


Deno.test("index.ts: 'Emitida' es el único estado usado para invoice.status_updated valid (nunca 'Timbrada')", () => {
  assert(!webhookIndexSource.includes('"Timbrada"'), "index.ts no debe usar el literal 'Timbrada'");
});

// ── Ola 5 · RG4-10: dispatch REP vs factura ────────────────────────────────
Deno.test("index.ts: los eventos invoice.* se intentan como factura antes que como REP", () => {
  assertStringIncludes(webhookIndexSource, 'event.type.startsWith("receipt.")');
  assertStringIncludes(webhookIndexSource, '!== "factura_not_found"');
  const idxFactura = webhookIndexSource.indexOf("await handleFacturaEvent(supabase, orgId, event)");
  const idxFallback = webhookIndexSource.indexOf('!== "factura_not_found"');
  assert(idxFactura >= 0 && idxFallback >= 0 && idxFactura < idxFallback);
});


// ── Ronda YAGNI · defecto 5: eventos tempranos son reintentables ────────────
// Si el objeto local todavía no existe, el evento NO está procesado: debe
// liberarse la reserva de dedupe y responder 503 para que FacturAPI reintente.
Deno.test("index.ts: *_not_found libera la reserva y responde 503 reintentable", () => {
  assertStringIncludes(webhookIndexSource, 'ignored === "factura_not_found" || ignored === "pago_not_found"');
  const idxGuard = webhookIndexSource.indexOf('ignored === "factura_not_found" || ignored === "pago_not_found"');
  const idxDelete = webhookIndexSource.indexOf(".delete()", idxGuard);
  assert(idxDelete > idxGuard, "debe liberar la reserva antes de pedir el reintento");
  const idx503 = webhookIndexSource.indexOf("503", idxGuard);
  assert(idx503 > idxDelete, "debe responder 503 (reintentable) tras liberar la reserva");
  assertStringIncludes(webhookIndexSource, '"target_not_found"');
});

Deno.test("index.ts: un duplicado real sigue devolviendo 200 idempotente", () => {
  // La reserva sólo se libera en fallo o *_not_found; el 23505 responde ok.
  assertStringIncludes(webhookIndexSource, 'ignored: "duplicate_event"');
  const idxDup = webhookIndexSource.indexOf('ignored: "duplicate_event"');
  const idxDelDespues = webhookIndexSource.indexOf(".delete()", idxDup);
  const idxDespachar = webhookIndexSource.indexOf("await despacharEvento(supabase, orgId, event)");
  assert(
    idxDup < idxDespachar,
    "el corto circuito por duplicado ocurre antes de procesar (sin borrar la reserva)",
  );
  assert(idxDelDespues > idxDespachar, "no se borra la reserva en la rama de duplicado");
});
