/**
 * Ola 4 · N1 — Idempotencia del claim de timbrado en facturapi-emitir-nota-credito.
 *
 * `claimNotaCredito` reclama la fila con `facturapi_id = PENDING:<uuid>` sólo
 * si el campo sigue NULL (`.is("facturapi_id", null)`). Si el claim ya fue
 * tomado (por un timbrado concurrente o exitoso previo), el segundo intento
 * de reclamar NO debe matchear ninguna fila: no se debe timbrar un segundo
 * CFDI para la misma nota de crédito.
 *
 * `preloadNcContext` complementa la defensa: si `facturapi_id` ya tiene
 * cualquier valor (incluido un claim `PENDING:` vigente), rechaza con
 * `ya_timbrada` antes de siquiera intentar reclamar.
 *
 * Mock mínimo del builder encadenado de supabase-js (sin red).
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { claimNotaCredito, preloadNcContext, type SupabaseLike } from "./data.ts";

/** Simula una tabla en memoria con soporte de `.update().eq().is().select().maybeSingle()`. */
function makeFakeSupabase(row: { id: string; facturapi_id: string | null }): SupabaseLike {
  const state = { ...row };
  const builder = {
    _matchesId: true,
    _matchesIsNull: true,
    update(patch: Record<string, unknown>) {
      this._patch = patch;
      return this;
    },
    eq(col: string, val: unknown) {
      if (col === "id" && val !== state.id) this._matchesId = false;
      if (col === "facturapi_id" && val !== state.facturapi_id) this._matchesId = false;
      return this;
    },
    is(col: string, val: null) {
      if (col === "facturapi_id" && state.facturapi_id !== val) this._matchesIsNull = false;
      return this;
    },
    select() {
      return this;
    },
    async maybeSingle() {
      if (this._matchesId && this._matchesIsNull && this._patch) {
        Object.assign(state, this._patch);
        return { data: { id: state.id }, error: null };
      }
      return { data: null, error: null };
    },
    from() {
      return this;
    },
  } as unknown as SupabaseLike;
  return {
    from: () => builder,
  } as unknown as SupabaseLike;
}

Deno.test("claimNotaCredito: reclama la NC cuando facturapi_id es NULL", async () => {
  const supabase = makeFakeSupabase({ id: "nc-1", facturapi_id: null });
  const claim = await claimNotaCredito(supabase, "nc-1");
  assert(claim.ok);
  if (claim.ok) {
    assert(claim.claimTag.startsWith("PENDING:"));
  }
});

Deno.test("claimNotaCredito: NO timbra dos veces — el segundo claim sobre una NC ya reclamada falla con 409", async () => {
  const supabase = makeFakeSupabase({ id: "nc-2", facturapi_id: "PENDING:ya-existente" });
  const claim = await claimNotaCredito(supabase, "nc-2");
  assert(!claim.ok);
  if (!claim.ok) {
    assertEquals(claim.status, 409);
    assertEquals((claim.body as { error: string }).error, "ya_timbrada");
  }
});

Deno.test("claimNotaCredito: NC ya timbrada (facturapi_id = ObjectId real) tampoco puede reclamarse", async () => {
  const supabase = makeFakeSupabase({ id: "nc-3", facturapi_id: "fac_ya_timbrado_123" });
  const claim = await claimNotaCredito(supabase, "nc-3");
  assert(!claim.ok);
  if (!claim.ok) assertEquals(claim.status, 409);
});

Deno.test("preloadNcContext: rechaza con ya_timbrada si facturapi_id ya está tomado (claim o CFDI real)", async () => {
  const supabase = {
    from: (table: string) => {
      if (table === "factura_notas_credito") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "nc-4",
                  factura_id: "f-1",
                  organization_id: "org-1",
                  serie: "A",
                  uso_cfdi: null,
                  forma_pago: null,
                  moneda: null,
                  tipo_cambio: null,
                  conceptos: [],
                  facturapi_id: "PENDING:otro-request",
                  estado: "Borrador",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`tabla inesperada: ${table}`);
    },
  } as unknown as SupabaseLike;

  const result = await preloadNcContext(supabase, "nc-4");
  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 409);
    assertEquals((result.body as { error: string }).error, "ya_timbrada");
  }
});
