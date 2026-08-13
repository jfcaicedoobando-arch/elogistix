import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveNextActionRep, type RepPendiente } from "./reconcile.ts";

const baseRep: RepPendiente = {
  id: "p1",
  organization_id: "o1",
  facturapi_rep_id: "fapi_rep_1",
  rep_cancellation_status: "pending",
};
const NOW = "2026-08-21T00:00:00.000Z";

Deno.test("REF-02: cancellation_status accepted cierra el REP", () => {
  const r = resolveNextActionRep({ status: "valid", cancellation_status: "accepted" }, baseRep, NOW);
  assertEquals(r.outcome, "accepted");
  assertEquals(r.patch, {
    estado_rep: "Cancelado",
    rep_cancellation_status: "accepted",
    rep_cancelado_en: NOW,
  });
});

Deno.test("REF-02: status canceled tambien cierra el REP", () => {
  const r = resolveNextActionRep({ status: "canceled" }, baseRep, NOW);
  assertEquals(r.outcome, "accepted");
});

Deno.test("REF-02: mismo estado no cambia nada", () => {
  const r = resolveNextActionRep({ status: "valid", cancellation_status: "pending" }, baseRep, NOW);
  assertEquals(r.outcome, "no_change");
  assertEquals(r.patch, {});
});

Deno.test("REF-02: rejected/expired solo actualizan el status, sin tocar estado_rep", () => {
  for (const cs of ["rejected", "expired"]) {
    const r = resolveNextActionRep({ status: "valid", cancellation_status: cs }, baseRep, NOW);
    assertEquals(r.outcome, cs);
    assertEquals(r.patch, { rep_cancellation_status: cs });
  }
});

Deno.test("REF-02: transicion pending -> verifying", () => {
  const r = resolveNextActionRep({ status: "valid", cancellation_status: "verifying" }, baseRep, NOW);
  assertEquals(r.outcome, "transition");
  assertEquals(r.patch, { rep_cancellation_status: "verifying" });
});

Deno.test("REF-02: sin cancellation_status remoto no cambia", () => {
  const r = resolveNextActionRep({ status: "valid" }, baseRep, NOW);
  assertEquals(r.outcome, "no_change");
});
