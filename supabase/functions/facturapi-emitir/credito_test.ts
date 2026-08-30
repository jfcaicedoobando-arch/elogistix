/**
 * Ola 3 · A — `validarLimiteCredito` debe ser fail-closed de verdad.
 *
 * Antes, si la lectura del cliente fallaba (o el cliente no existía) la función
 * devolvía `null` = "adelante, timbra": exactamente lo contrario de M-15.
 * Aquí se fija el contrato con mocks mínimos (sin red).
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validarLimiteCredito } from "./credito.ts";
import type { FacturaRow } from "./types.ts";

const factura = {
  id: "f-1",
  cliente_id: "c-1",
  organization_id: "org-1",
  moneda: "MXN",
  tipo_cambio: null,
  total: 1000,
} as unknown as FacturaRow;

interface ClienteResult { data: unknown; error: unknown }

function makeSupabase(clienteResult: ClienteResult, rpcResult: ClienteResult = { data: 0, error: null }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => clienteResult }),
      }),
    }),
    rpc: async () => rpcResult,
    // authorizeOrgRole no debe alcanzarse en estos casos.
  } as unknown as Parameters<typeof validarLimiteCredito>[0];
}

Deno.test("credito: error al leer el cliente => 503 credito_no_verificable (no continúa al PAC)", async () => {
  const supabase = makeSupabase({ data: null, error: { code: "PGRST500", message: "boom" } });
  const res = await validarLimiteCredito(supabase, factura, "u-1");
  assertEquals(res?.status, 503);
  assertEquals((await res!.json()).error, "credito_no_verificable");
});

Deno.test("credito: cliente inexistente => 404 cliente_not_found (nunca null)", async () => {
  const supabase = makeSupabase({ data: null, error: null });
  const res = await validarLimiteCredito(supabase, factura, "u-1");
  assertEquals(res?.status, 404);
  assertEquals((await res!.json()).error, "cliente_not_found");
});

Deno.test("credito: límite NULL o 0 = sin límite configurado => permite timbrar", async () => {
  for (const limite of [null, 0]) {
    const supabase = makeSupabase({ data: { nombre: "ACME", limite_credito_mxn: limite }, error: null });
    assertEquals(await validarLimiteCredito(supabase, factura, "u-1"), null);
  }
});

Deno.test("credito: error de la RPC de exposición sigue devolviendo 503", async () => {
  const supabase = makeSupabase(
    { data: { nombre: "ACME", limite_credito_mxn: 5000 }, error: null },
    { data: null, error: { message: "rpc down" } },
  );
  const res = await validarLimiteCredito(supabase, factura, "u-1");
  assertEquals(res?.status, 503);
  assertEquals((await res!.json()).error, "credito_no_verificable");
});
