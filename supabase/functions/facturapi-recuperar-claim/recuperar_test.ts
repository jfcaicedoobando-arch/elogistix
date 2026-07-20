/**
 * v13.303.3 — Cobertura pura de `recuperar.ts` (FIX-04.1).
 *
 * Validamos las ramas de `validarClaim` que gobiernan si un claim
 * `PENDING:<uuid>` puede recuperarse o hay que esperar la ventana de gracia.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MIN_EDAD_MINUTOS, validarClaim, type FacturaRow } from "./recuperar.ts";

const baseFactura: FacturaRow = {
  id: "00000000-0000-0000-0000-000000000001",
  organization_id: "00000000-0000-0000-0000-000000000010",
  facturapi_id: null,
  facturapi_claim_at: null,
  serie: "A",
  numero: null,
};

Deno.test("validarClaim: sin PENDING responde no_pending (200)", async () => {
  const r = validarClaim({ ...baseFactura, facturapi_id: "abc123" });
  assert(r.response, "debe responder inmediatamente");
  assertEquals(r.response!.status, 200);
  const json = await r.response!.json();
  assertEquals(json.outcome, "no_pending");
});

Deno.test("validarClaim: PENDING reciente responde too_early (425)", async () => {
  const claimAt = new Date(Date.now() - 60_000).toISOString(); // 1 min
  const r = validarClaim({
    ...baseFactura,
    facturapi_id: "PENDING:aaa",
    facturapi_claim_at: claimAt,
  });
  assert(r.response, "debe bloquear por gracia");
  assertEquals(r.response!.status, 425);
  const json = await r.response!.json();
  assertEquals(json.outcome, "too_early");
});

Deno.test("validarClaim: PENDING con edad >= umbral autoriza recuperación", () => {
  const claimAt = new Date(Date.now() - (MIN_EDAD_MINUTOS + 1) * 60_000).toISOString();
  const r = validarClaim({
    ...baseFactura,
    facturapi_id: "PENDING:bbb",
    facturapi_claim_at: claimAt,
  });
  assertEquals(r.response, undefined);
  assertEquals(r.claimTag, "PENDING:bbb");
  assert(r.edadMin >= MIN_EDAD_MINUTOS);
});

Deno.test("validarClaim: PENDING sin claim_at trata edad como infinita (autoriza)", () => {
  const r = validarClaim({
    ...baseFactura,
    facturapi_id: "PENDING:ccc",
    facturapi_claim_at: null,
  });
  assertEquals(r.response, undefined);
  assertEquals(Number.isFinite(r.edadMin), false);
});
