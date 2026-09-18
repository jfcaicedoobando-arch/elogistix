/**
 * P0-A.4 — El webhook debe encontrar la fila de un intento con TIMBRADO
 * PENDIENTE (por id remoto pendiente o por el `external_id` del evento) y
 * promoverla sólo cuando el evento trae UUID válido.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  COLS_FACTURA,
  COLS_REP,
  externalIdDeEvento,
  localizarFila,
  patchAdopcionPendiente,
} from "./pendiente.ts";

const UUID = "5f9c1c2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b";

/** Fake mínimo: resuelve la fila sólo para el par (columna, valor) esperado. */
function fakeDb(match: { col: string; valor: string }, fila: unknown) {
  const consultas: Array<[string, string]> = [];
  const db = {
    from: () => ({
      select: () => ({
        eq: (col: string, valor: string) => {
          consultas.push([col, valor]);
          return {
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: col === match.col && valor === match.valor ? fila : null }),
            }),
          };
        },
      }),
    }),
  };
  return { db, consultas };
}

const base = {
  tabla: "facturas",
  select: "id",
  orgId: "org1",
  cols: COLS_FACTURA,
  remoteId: "inv_remoto",
};

Deno.test("localiza por facturapi_id (camino normal)", async () => {
  const { db } = fakeDb({ col: "facturapi_id", valor: "inv_remoto" }, { id: "f1" });
  // SAFE-CAST: fake con el subconjunto de la API usado por localizarFila.
  const r = await localizarFila<{ id: string }>({ ...base, supabase: db as never, externalId: null });
  assertEquals(r?.via, "claim");
  assertEquals(r?.fila.id, "f1");
});

Deno.test("localiza por id remoto pendiente cuando el claim sigue PENDING", async () => {
  const { db } = fakeDb({ col: "facturapi_pendiente_id", valor: "inv_remoto" }, { id: "f2" });
  const r = await localizarFila<{ id: string }>({ ...base, supabase: db as never, externalId: null });
  assertEquals(r?.via, "pendiente");
  assertEquals(r?.fila.id, "f2");
});

Deno.test("localiza por external_id del evento (claimTag)", async () => {
  const { db, consultas } = fakeDb({ col: "facturapi_id", valor: "PENDING:abc" }, { id: "f3" });
  const r = await localizarFila<{ id: string }>({
    ...base, supabase: db as never, externalId: "PENDING:abc",
  });
  assertEquals(r?.via, "pendiente");
  assertEquals(r?.fila.id, "f3");
  assertEquals(consultas.length, 3);
});

Deno.test("sin coincidencias devuelve null (el webhook responde not_found y reintenta)", async () => {
  const { db } = fakeDb({ col: "nada", valor: "nada" }, { id: "x" });
  const r = await localizarFila({ ...base, supabase: db as never, externalId: "PENDING:abc" });
  assertEquals(r, null);
});

Deno.test("externalIdDeEvento lee el external_id del objeto", () => {
  assertEquals(externalIdDeEvento({ type: "invoice.status_updated", data: { object: { external_id: "PENDING:x" } } }), "PENDING:x");
  assertEquals(externalIdDeEvento({ type: "invoice.status_updated", data: { object: {} } }), null);
  assertEquals(externalIdDeEvento({ type: "invoice.status_updated" }), null);
});

Deno.test("un evento con UUID válido adopta el id definitivo y limpia el pendiente", () => {
  const adopcion = patchAdopcionPendiente(COLS_FACTURA, "inv_remoto", { uuid_fiscal: UUID, estado: "Emitida" });
  assert(adopcion);
  assertEquals(adopcion.facturapi_id, "inv_remoto");
  assertEquals(adopcion.facturapi_claim_at, null);
  assertEquals(adopcion.facturapi_pendiente_id, null);
  assertEquals(adopcion.facturapi_pendiente_at, null);
});

Deno.test("un evento sin UUID válido NO promueve (la fila queda pendiente)", () => {
  assertEquals(patchAdopcionPendiente(COLS_FACTURA, "inv_remoto", { estado: "Emitida" }), null);
  assertEquals(patchAdopcionPendiente(COLS_FACTURA, "inv_remoto", { uuid_fiscal: "" }), null);
  assertEquals(patchAdopcionPendiente(COLS_REP, "inv_remoto", { estado_rep: "Timbrado" }), null);
});

Deno.test("el REP usa sus propias columnas de claim/pendiente", () => {
  const adopcion = patchAdopcionPendiente(COLS_REP, "inv_rep", { uuid_rep: UUID });
  assert(adopcion);
  assertEquals(adopcion.facturapi_rep_id, "inv_rep");
  assertEquals(adopcion.facturapi_rep_claim_at, null);
  assertEquals(adopcion.facturapi_rep_pendiente_id, null);
});
