/**
 * v13.303.3 — Cobertura pura de `recuperar.ts` (FIX-04.1).
 *
 * Validamos las ramas de `validarClaim` que gobiernan si un claim
 * `PENDING:<uuid>` puede recuperarse o hay que esperar la ventana de gracia.
 */
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  MIN_EDAD_MINUTOS, validarClaim, promoverNc, liberarClaimNc,
  type FacturaRow, type NotaCreditoRow as NcRow,
} from "./recuperar.ts";

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

// ── Ola 5 · RG4-4 — recuperación de claims en notas de crédito ──────────

const baseNc: NcRow = {
  id: "nc-1",
  organization_id: "org-1",
  facturapi_id: "PENDING:nc-1",
  facturapi_claim_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  serie: "NC",
  folio: "BORRADOR-1",
};

const ncUser = { id: "user-1", email: "u@example.com" };

/** Simula update().eq().lt().select().maybeSingle() + el insert de bitácora, sin red. */
function makeFakeNcSupabase(row: { id: string; facturapi_id: string | null; facturapi_claim_at: string | null }) {
  const state: Record<string, unknown> = { ...row };
  const builder = {
    _patch: null as Record<string, unknown> | null,
    _match: true,
    update(patch: Record<string, unknown>) { this._patch = patch; return this; },
    eq(col: string, val: unknown) { if (state[col] !== val) this._match = false; return this; },
    lt(col: string, val: string) {
      const cur = state[col];
      if (!(typeof cur === "string" && cur < val)) this._match = false;
      return this;
    },
    select() { return this; },
    async maybeSingle() {
      if (this._match && this._patch) {
        Object.assign(state, this._patch);
        return { data: { id: state.id }, error: null };
      }
      return { data: null, error: null };
    },
    async insert() { return { error: null }; },
  };
  return { state, supabase: { from: () => builder } as unknown as SupabaseClient };
}

Deno.test("validarClaim: acepta una fila de NC y rotula la entidad en no_pending", async () => {
  const r = validarClaim({ facturapi_id: "fac_real", facturapi_claim_at: null }, "nota de crédito");
  assert(r.response, "debe responder inmediatamente");
  const json = await r.response!.json();
  assertEquals(json.outcome, "no_pending");
  assertStringIncludes(json.message, "nota de crédito");
});

Deno.test("promoverNc: adopta el CFDI timbrado en FacturAPI y limpia el claim", async () => {
  const { state, supabase } = makeFakeNcSupabase({
    id: baseNc.id, facturapi_id: baseNc.facturapi_id, facturapi_claim_at: baseNc.facturapi_claim_at!,
  });
  const res = await promoverNc({
    supabase, nc: baseNc, claimTag: "PENDING:nc-1", user: ncUser,
    match: {
      id: "fac_real_1", uuid: "UUID-NC-1", folio_number: 7, series: "NC",
      external_id: "PENDING:nc-1", status: "valid", date: "2026-08-18T12:00:00.000Z",
    },
    apiKey: "", ambiente: "test",
  });
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.outcome, "promovido");
  assertEquals(json.facturapi_id, "fac_real_1");
  assertEquals(state.facturapi_id, "fac_real_1");
  assertEquals(state.facturapi_claim_at, null);
});

Deno.test("promoverNc: 409 claim_perdido si el claim cambió antes de persistir", async () => {
  const { supabase } = makeFakeNcSupabase({
    id: baseNc.id, facturapi_id: "OTRO_TAG", facturapi_claim_at: baseNc.facturapi_claim_at!,
  });
  const res = await promoverNc({
    supabase, nc: baseNc, claimTag: "PENDING:nc-1", user: ncUser,
    match: { id: "fac_real_2", uuid: "UUID-NC-2", folio_number: 1, series: "NC" },
    apiKey: "", ambiente: "test",
  });
  assertEquals(res.status, 409);
  const json = await res.json();
  assertEquals(json.outcome, "claim_perdido");
});

Deno.test("liberarClaimNc: libera cuando el claim exacto tiene edad suficiente", async () => {
  const { state, supabase } = makeFakeNcSupabase({
    id: baseNc.id, facturapi_id: baseNc.facturapi_id, facturapi_claim_at: baseNc.facturapi_claim_at!,
  });
  const res = await liberarClaimNc(supabase, baseNc, "PENDING:nc-1", 10, ncUser);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.outcome, "liberado");
  assertEquals(state.facturapi_id, null);
  assertEquals(state.facturapi_claim_at, null);
});

Deno.test("liberarClaimNc: sin_cambios si el claim ya no coincide", async () => {
  const { supabase } = makeFakeNcSupabase({
    id: baseNc.id, facturapi_id: "OTRO_TAG", facturapi_claim_at: baseNc.facturapi_claim_at!,
  });
  const res = await liberarClaimNc(supabase, baseNc, "PENDING:nc-1", 10, ncUser);
  const json = await res.json();
  assertEquals(json.outcome, "sin_cambios");
});
