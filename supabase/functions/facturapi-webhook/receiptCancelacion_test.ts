/**
 * P1 · FacturAPI 5.0 — `receipt.cancellation_status_updated`.
 * Payload + orden de eventos: `accepted` es terminal y los eventos atrasados
 * no lo revierten.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapEventToReceiptPatch, type FacturapiWebhookEvent } from "./helpers.ts";

function ev(type: string, obj: Record<string, unknown>): FacturapiWebhookEvent {
  return { type, data: { object: { id: "rep_1", ...obj } } };
}

/** Espejo del guard de orden del handler (index.ts · handleReceiptEvent). */
function aplicarGuard(
  pago: { estado_rep: string | null; rep_cancellation_status: string | null },
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...patch };
  if (pago.estado_rep === "Cancelado" && out.estado_rep === "Timbrado") {
    delete out.estado_rep;
    delete out.timbrado_rep_en;
  }
  if (
    pago.rep_cancellation_status === "accepted" &&
    typeof out.rep_cancellation_status === "string" &&
    out.rep_cancellation_status !== "accepted"
  ) {
    delete out.rep_cancellation_status;
  }
  return out;
}

Deno.test("receipt.cancellation_status_updated accepted cierra el REP", () => {
  const m = mapEventToReceiptPatch(ev("receipt.cancellation_status_updated", { cancellation_status: "accepted" }));
  assertEquals(m?.facturapi_rep_id, "rep_1");
  assertEquals(m?.patch.rep_cancellation_status, "accepted");
  assertEquals(m?.patch.estado_rep, "Cancelado");
  assertEquals(typeof m?.patch.rep_cancelado_en, "string");
  assertEquals(m?.bitacora_accion, "facturapi_webhook_rep_cancellation_status");
});

Deno.test("estados intermedios sólo reportan, no cierran el REP", () => {
  for (const st of ["pending", "verifying", "rejected", "expired"]) {
    const m = mapEventToReceiptPatch(ev("receipt.cancellation_status_updated", { cancellation_status: st }));
    assertEquals(m?.patch.rep_cancellation_status, st);
    assertEquals(m?.patch.estado_rep, undefined);
  }
});

Deno.test("cancellation_status se normaliza a minúsculas", () => {
  const m = mapEventToReceiptPatch(ev("receipt.cancellation_status_updated", { cancellation_status: "ACCEPTED" }));
  assertEquals(m?.patch.rep_cancellation_status, "accepted");
});

Deno.test("sin cancellation_status el evento se ignora", () => {
  assertEquals(mapEventToReceiptPatch(ev("receipt.cancellation_status_updated", {})), null);
});

Deno.test("invoice.cancellation_status_updated se mapea igual para un REP", () => {
  const rec = mapEventToReceiptPatch(ev("receipt.cancellation_status_updated", { cancellation_status: "accepted" }));
  const inv = mapEventToReceiptPatch(ev("invoice.cancellation_status_updated", { cancellation_status: "accepted" }));
  assertEquals(Object.keys(inv?.patch ?? {}).sort(), Object.keys(rec?.patch ?? {}).sort());
  assertEquals(inv?.patch.estado_rep, "Cancelado");
});

Deno.test("orden: verifying atrasado no revierte un accepted persistido", () => {
  const m = mapEventToReceiptPatch(ev("receipt.cancellation_status_updated", { cancellation_status: "verifying" }));
  const patch = aplicarGuard({ estado_rep: "Cancelado", rep_cancellation_status: "accepted" }, m!.patch);
  assertEquals(Object.keys(patch).length, 0);
});

Deno.test("orden: status_updated valid atrasado no resucita un REP cancelado", () => {
  const m = mapEventToReceiptPatch(ev("receipt.status_updated", { status: "valid", uuid: "22222222-2222-2222-2222-222222222222" }));
  const patch = aplicarGuard({ estado_rep: "Cancelado", rep_cancellation_status: "accepted" }, m!.patch);
  assertEquals(patch.estado_rep, undefined);
  assertEquals(patch.uuid_rep, "22222222-2222-2222-2222-222222222222");
});

Deno.test("orden: accepted llega después de pending y sí cierra", () => {
  const m = mapEventToReceiptPatch(ev("receipt.cancellation_status_updated", { cancellation_status: "accepted" }));
  const patch = aplicarGuard({ estado_rep: "Timbrado", rep_cancellation_status: "pending" }, m!.patch);
  assertEquals(patch.rep_cancellation_status, "accepted");
  assertEquals(patch.estado_rep, "Cancelado");
});
