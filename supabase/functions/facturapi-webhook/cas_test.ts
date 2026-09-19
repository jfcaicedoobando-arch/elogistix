/**
 * P0 correctivo — regresión del webhook tardío.
 *
 * Un aviso viejo no debe pisar una fila que ya fue liberada y recapturada por
 * otro intento: la escritura usa CAS sobre la columna de claim.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { aplicarPatchConCas } from "./facturaPatch.ts";
import { claimEsPendiente, COLS_FACTURA, patchAdopcionPendiente } from "./pendiente.ts";

interface Filtro {
  col: string;
  val: string;
}

function supabaseFake(filas: Array<{ id: string }>) {
  const filtros: Filtro[] = [];
  let patchRecibido: Record<string, unknown> | null = null;
  const chain = {
    update(p: Record<string, unknown>) {
      patchRecibido = p;
      return chain;
    },
    eq(col: string, val: string) {
      filtros.push({ col, val });
      return chain;
    },
    select() {
      return Promise.resolve({ data: filas, error: null });
    },
  };
  return {
    // deno-lint-ignore no-explicit-any
    client: { from: () => chain } as any,
    filtros,
    get patch() {
      return patchRecibido;
    },
  };
}

Deno.test("CAS incluye la columna de claim y aplica cuando la fila sigue siendo del intento", async () => {
  const sb = supabaseFake([{ id: "f1" }]);
  const res = await aplicarPatchConCas({
    supabase: sb.client,
    tabla: "facturas",
    id: "f1",
    claimCol: COLS_FACTURA.claim,
    claimEsperado: "PENDING:abc",
    patch: { estado: "Emitida" },
  });
  assertEquals(res, null);
  assertEquals(sb.filtros, [
    { col: "id", val: "f1" },
    { col: "facturapi_id", val: "PENDING:abc" },
  ]);
});

Deno.test("webhook tardío tras liberar/reclamar no escribe: 0 filas ⇒ ignorado", async () => {
  const sb = supabaseFake([]);
  const res = await aplicarPatchConCas({
    supabase: sb.client,
    tabla: "facturas",
    id: "f1",
    claimCol: COLS_FACTURA.claim,
    claimEsperado: "PENDING:viejo",
    patch: { estado: "Emitida" },
  });
  assertEquals(res?.status, 200);
  assertEquals((await res!.json()).ignored, "claim_cambiado");
});

Deno.test("sin claim esperado sólo filtra por id (vía directa)", async () => {
  const sb = supabaseFake([{ id: "f1" }]);
  await aplicarPatchConCas({
    supabase: sb.client,
    tabla: "facturas",
    id: "f1",
    claimCol: COLS_FACTURA.claim,
    claimEsperado: null,
    patch: { estado: "Cancelado" },
  });
  assertEquals(sb.filtros, [{ col: "id", val: "f1" }]);
});

Deno.test("la vía pendiente exige claim PENDING vivo y limpia los campos pendientes", () => {
  assertEquals(claimEsPendiente("PENDING:abc"), true);
  assertEquals(claimEsPendiente("fapi_123"), false);
  assertEquals(claimEsPendiente(null), false);

  const adopcion = patchAdopcionPendiente(COLS_FACTURA, "fapi_9", { uuid_fiscal: "UUID-1" });
  assertEquals(adopcion, {
    facturapi_id: "fapi_9",
    facturapi_claim_at: null,
    facturapi_pendiente_id: null,
    facturapi_pendiente_at: null,
  });
  assertEquals(patchAdopcionPendiente(COLS_FACTURA, "fapi_9", {}), null);
});
