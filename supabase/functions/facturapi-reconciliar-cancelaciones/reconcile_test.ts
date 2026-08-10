import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveNextAction,
  agruparPorOrg,
  nuevoResumen,
  acumularOutcome,
  descargarAcuse,
  type FacturaPendiente,
} from "./reconcile.ts";

const baseFactura: FacturaPendiente = {
  id: "f1",
  organization_id: "org-1",
  facturapi_id: "fapi-1",
  cancellation_status: "pending",
  sustituida_por: null,
};

Deno.test("resolveNextAction: sin cambio cuando estados coinciden", () => {
  const r = resolveNextAction({ cancellation_status: "pending" }, baseFactura, "2026-01-01T00:00:00Z");
  assertEquals(r.outcome, "no_change");
  assertEquals(r.patch, {});
});

Deno.test("resolveNextAction: accepted marca Cancelada si no hay sustituta", () => {
  const r = resolveNextAction({ cancellation_status: "accepted" }, baseFactura, "2026-01-01T00:00:00Z");
  assertEquals(r.outcome, "accepted");
  assertEquals(r.patch.estado, "Cancelada");
  assertEquals(r.patch.cancellation_status, "accepted");
});

Deno.test("resolveNextAction: accepted marca Sustituida si hay sustituta", () => {
  const r = resolveNextAction(
    { cancellation_status: "accepted" },
    { ...baseFactura, sustituida_por: "f2" },
    "2026-01-01T00:00:00Z",
  );
  assertEquals(r.outcome, "accepted");
  assertEquals(r.patch.estado, "Sustituida");
});

Deno.test("resolveNextAction: rejected limpia fechas de solicitud", () => {
  const r = resolveNextAction({ cancellation_status: "rejected" }, baseFactura, "2026-01-01T00:00:00Z");
  assertEquals(r.outcome, "rejected");
  assertEquals(r.patch.cancellation_status, "rejected");
  assertEquals(r.patch.cancelacion_solicitada_en, null);
});

Deno.test("resolveNextAction: expired también limpia fechas", () => {
  const r = resolveNextAction({ cancellation_status: "expired" }, baseFactura, "2026-01-01T00:00:00Z");
  assertEquals(r.outcome, "expired");
  assertEquals(r.patch.cancelacion_vence_en, null);
});

Deno.test("resolveNextAction: transición intermedia (pending->verifying)", () => {
  const r = resolveNextAction({ cancellation_status: "verifying" }, baseFactura, "2026-01-01T00:00:00Z");
  assertEquals(r.outcome, "transition");
  assertEquals(r.patch, { cancellation_status: "verifying" });
});

Deno.test("resolveNextAction: status=canceled sin cancellation_status = accepted", () => {
  const r = resolveNextAction({ status: "canceled" }, baseFactura, "2026-01-01T00:00:00Z");
  assertEquals(r.outcome, "accepted");
});

Deno.test("resolveNextAction: remoto vacío + local pending => no_change (NO limpia auto)", () => {
  const r = resolveNextAction({}, baseFactura, "2026-01-01T00:00:00Z");
  assertEquals(r.outcome, "no_change");
  assertEquals(r.patch, {});
});

Deno.test("resolveNextAction: remoto cancellation_status='' + local verifying => no_change", () => {
  const r = resolveNextAction(
    { cancellation_status: "" },
    { ...baseFactura, cancellation_status: "verifying" },
    "2026-01-01T00:00:00Z",
  );
  assertEquals(r.outcome, "no_change");
});

Deno.test("resolveNextAction: remoto vacío + status=canceled sigue siendo accepted", () => {
  const r = resolveNextAction({ status: "canceled" }, baseFactura, "2026-01-01T00:00:00Z");
  assertEquals(r.outcome, "accepted");
});

Deno.test("resolveNextAction: status=canceled repara aunque cs coincida en ambos lados (Ola 4 · N18)", () => {
  const r = resolveNextAction(
    { status: "canceled", cancellation_status: "accepted" },
    { ...baseFactura, cancellation_status: "accepted" },
    "2026-01-01T00:00:00Z",
  );
  assertEquals(r.outcome, "accepted");
  assertEquals(r.patch.estado, "Cancelada");
});

Deno.test("resolveNextAction: status=canceled con cs='none' en ambos lados también repara (Ola 4 · N18)", () => {
  const r = resolveNextAction(
    { status: "canceled", cancellation_status: "none" },
    { ...baseFactura, cancellation_status: "none" },
    "2026-01-01T00:00:00Z",
  );
  assertEquals(r.outcome, "accepted");
});

Deno.test("agruparPorOrg: agrupa por organization_id", () => {
  const map = agruparPorOrg([
    baseFactura,
    { ...baseFactura, id: "f2" },
    { ...baseFactura, id: "f3", organization_id: "org-2" },
  ]);
  assertEquals(map.size, 2);
  assertEquals(map.get("org-1")?.length, 2);
  assertEquals(map.get("org-2")?.length, 1);
});

Deno.test("acumularOutcome: incrementa contadores correctos", () => {
  const r = nuevoResumen();
  acumularOutcome(r, "accepted");
  acumularOutcome(r, "rejected");
  acumularOutcome(r, "expired");
  acumularOutcome(r, "no_change");
  assertEquals(r.aceptadas, 1);
  assertEquals(r.rechazadas, 1);
  assertEquals(r.expiradas, 1);
  assertEquals(r.sin_cambio, 1);
});

Deno.test("descargarAcuse: 200 devuelve xml accepted", async () => {
  const fakeFetch = ((_url: string) =>
    Promise.resolve(new Response("<xml/>", { status: 200 }))) as typeof fetch;
  const r = await descargarAcuse("id", "key", fakeFetch);
  assertEquals(r.status, "accepted");
  assertEquals(r.xml, "<xml/>");
});

Deno.test("descargarAcuse: 404 devuelve pending", async () => {
  const fakeFetch = ((_url: string) =>
    Promise.resolve(new Response("", { status: 404 }))) as typeof fetch;
  const r = await descargarAcuse("id", "key", fakeFetch);
  assertEquals(r.status, "pending");
  assertEquals(r.xml, null);
});

Deno.test("descargarAcuse: error de red devuelve error_network", async () => {
  const fakeFetch = ((_url: string) => Promise.reject(new Error("net"))) as unknown as typeof fetch;
  const r = await descargarAcuse("id", "key", fakeFetch);
  assertEquals(r.status, "error_network");
});
