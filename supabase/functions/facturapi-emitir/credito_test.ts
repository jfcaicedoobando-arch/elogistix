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

Deno.test("credito: límite NULL = sin límite configurado => permite continuar sin consultar exposición", async () => {
  const { supabase, fueLlamada } = makeSupabaseConRpcEspiada({
    data: { nombre: "ACME", limite_credito_mxn: null }, error: null,
  });
  assertEquals(await validarLimiteCredito(supabase, factura, "u-1"), null);
  assertEquals(fueLlamada(), false);
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

// YG-01 — un TC inválido para moneda != MXN ya no debe usar factor 1 (fallback
// que subestimaba el límite): debe ser fail-closed (503) y no llegar a la RPC
// de crédito ni al PAC.
function makeFactura(overrides: Partial<typeof factura>) {
  return { ...factura, ...overrides } as unknown as FacturaRow;
}

function makeSupabaseConRpcEspiada(clienteResult: ClienteResult) {
  let rpcLlamada = false;
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => clienteResult }),
      }),
    }),
    rpc: async () => {
      rpcLlamada = true;
      return { data: 0, error: null };
    },
  } as unknown as Parameters<typeof validarLimiteCredito>[0];
  return { supabase, fueLlamada: () => rpcLlamada };
}

const clienteConLimite = { nombre: "ACME", limite_credito_mxn: 5000 };

Deno.test("credito: MXN pasa sin necesitar tipo_cambio", async () => {
  const f = makeFactura({ moneda: "MXN", tipo_cambio: null, total: 1000 });
  const supabase = makeSupabase({ data: clienteConLimite, error: null });
  assertEquals(await validarLimiteCredito(supabase, f, "u-1"), null);
});

Deno.test("credito: USD con TC válido (18) usa ese factor", async () => {
  const f = makeFactura({ moneda: "USD", tipo_cambio: 18, total: 100 });
  // enUso=0, limite=5000: 100*18=1800 <= 5000 => null (no excede)
  const supabase = makeSupabase({ data: clienteConLimite, error: null });
  assertEquals(await validarLimiteCredito(supabase, f, "u-1"), null);
});

for (const tcInvalido of [null, 0, 1, 4.99, 40.01]) {
  Deno.test(`credito: USD con TC inválido (${tcInvalido}) => 503 credito_no_verificable y no llama RPC`, async () => {
    const f = makeFactura({ moneda: "USD", tipo_cambio: tcInvalido, total: 100 });
    const { supabase, fueLlamada } = makeSupabaseConRpcEspiada({ data: clienteConLimite, error: null });
    const res = await validarLimiteCredito(supabase, f, "u-1");
    assertEquals(res?.status, 503);
    assertEquals((await res!.json()).error, "credito_no_verificable");
    assertEquals(fueLlamada(), false);
  });
}

Deno.test("credito: EUR con TC válido (20) usa ese factor", async () => {
  const f = makeFactura({ moneda: "EUR", tipo_cambio: 20, total: 100 });
  const supabase = makeSupabase({ data: clienteConLimite, error: null });
  assertEquals(await validarLimiteCredito(supabase, f, "u-1"), null);
});

Deno.test("credito: EUR con TC inválido (2) => 503 credito_no_verificable", async () => {
  const f = makeFactura({ moneda: "EUR", tipo_cambio: 2, total: 100 });
  const { supabase, fueLlamada } = makeSupabaseConRpcEspiada({ data: clienteConLimite, error: null });
  const res = await validarLimiteCredito(supabase, f, "u-1");
  assertEquals(res?.status, 503);
  assertEquals((await res!.json()).error, "credito_no_verificable");
  assertEquals(fueLlamada(), false);
});

Deno.test("credito: sin límite (NULL) => conserva bypass de TC y exposición", async () => {
  const f = makeFactura({ moneda: "USD", tipo_cambio: null, total: 100 });
  const { supabase, fueLlamada } = makeSupabaseConRpcEspiada({ data: { nombre: "ACME", limite_credito_mxn: null }, error: null });
  assertEquals(await validarLimiteCredito(supabase, f, "u-1"), null);
  assertEquals(fueLlamada(), false);
});

Deno.test("credito: límite 0 con USD y TC inválido => 503 antes de consultar exposición", async () => {
  const f = makeFactura({ moneda: "USD", tipo_cambio: null, total: 100 });
  const { supabase, fueLlamada } = makeSupabaseConRpcEspiada({ data: { nombre: "ACME", limite_credito_mxn: 0 }, error: null });
  const res = await validarLimiteCredito(supabase, f, "u-1");
  assertEquals(res?.status, 503);
  assertEquals((await res!.json()).error, "credito_no_verificable");
  assertEquals(fueLlamada(), false);
});

function makeSupabaseConExposicion(
  limite: number | string,
  enUso: number,
  rolOrg = "operador",
  orgMiembro = factura.organization_id,
  errorUso: unknown = null,
) {
  let rpcLlamadas = 0;
  let consultasRoles = 0;
  const supabase = {
    from: (table: string) => {
      const filtros: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filtros[column] = value;
          return query;
        },
        maybeSingle: async () => {
          if (table === "clientes") {
            assertEquals(filtros, { id: factura.cliente_id });
            return { data: { nombre: "ACME", limite_credito_mxn: limite }, error: null };
          }
          consultasRoles++;
          if (table === "user_roles") {
            assertEquals(filtros, { user_id: "u-1", role: "super_admin" });
            return { data: null, error: null };
          }
          assertEquals(table, "organization_members");
          assertEquals(filtros, { user_id: "u-1", organization_id: factura.organization_id });
          return {
            data: filtros.organization_id === orgMiembro ? { role: rolOrg } : null,
            error: null,
          };
        },
      };
      return query;
    },
    rpc: (name: string, args: unknown) => {
      rpcLlamadas++;
      assertEquals(name, "credito_en_uso_mxn");
      assertEquals(args, { p_cliente_id: factura.cliente_id });
      return Promise.resolve({ data: enUso, error: errorUso });
    },
  } as unknown as Parameters<typeof validarLimiteCredito>[0];
  return { supabase, llamadasRpc: () => rpcLlamadas, llamadasRoles: () => consultasRoles };
}

for (const limite of [0, "0"]) {
  for (const enUso of [0, 500]) {
    Deno.test(`credito: límite ${JSON.stringify(limite)} y exposición ${enUso} => 409 para operador`, async () => {
      const { supabase, llamadasRpc } = makeSupabaseConExposicion(limite, enUso);
      const res = await validarLimiteCredito(supabase, factura, "u-1");
      assertEquals(res?.status, 409);
      const body = await res!.json();
      assertEquals(body.error, "credito_excedido");
      assertEquals(body.message.includes(`$${(enUso + 1000).toFixed(2)} MXN`), true);
      assertEquals(body.message.includes("$0.00 MXN"), true);
      assertEquals(llamadasRpc(), 1);
    });
  }
}

for (const enUso of [0, 4000, 4000.01]) {
  Deno.test(`credito: límite positivo compara exposición ${enUso} más la factura (incluye igualdad)`, async () => {
    const { supabase, llamadasRpc } = makeSupabaseConExposicion(5000, enUso);
    const res = await validarLimiteCredito(supabase, factura, "u-1");
    if (enUso + 1000 <= 5000) {
      assertEquals(res, null);
    } else {
      assertEquals(res?.status, 409);
      assertEquals((await res!.json()).error, "credito_excedido");
    }
    assertEquals(llamadasRpc(), 1);
  });
}

Deno.test("credito: exposición previa más USD convertidos a MXN exceden el límite", async () => {
  const { supabase, llamadasRpc } = makeSupabaseConExposicion(5000, 4000);
  const f = makeFactura({ moneda: "USD", tipo_cambio: 18, total: 100 });
  const res = await validarLimiteCredito(supabase, f, "u-1");
  assertEquals(res?.status, 409);
  const body = await res!.json();
  assertEquals(body.error, "credito_excedido");
  assertEquals(body.message.includes("$5800.00 MXN"), true);
  assertEquals(llamadasRpc(), 1);
});

for (const limite of [0, 500]) {
  Deno.test(`credito: límite ${limite} conserva excepción para contador de la organización`, async () => {
    const { supabase, llamadasRpc } = makeSupabaseConExposicion(limite, 500, "contador");
    assertEquals(await validarLimiteCredito(supabase, factura, "u-1"), null);
    assertEquals(llamadasRpc(), 1);
  });

  Deno.test(`credito: límite ${limite} no acepta excepción de otra organización`, async () => {
    const { supabase } = makeSupabaseConExposicion(limite, 500, "contador", "org-ajena");
    const res = await validarLimiteCredito(supabase, factura, "u-1");
    assertEquals(res?.status, 409);
    assertEquals((await res!.json()).error, "credito_excedido");
  });
}

for (const rol of ["operador", "contador"]) {
  Deno.test(`credito: límite 0 falla cerrado para ${rol} si no puede consultar exposición`, async () => {
    const { supabase, llamadasRpc, llamadasRoles } = makeSupabaseConExposicion(
      0, 0, rol, factura.organization_id, { message: "rpc down" },
    );
    const res = await validarLimiteCredito(supabase, factura, "u-1");
    assertEquals(res?.status, 503);
    assertEquals((await res!.json()).error, "credito_no_verificable");
    assertEquals(llamadasRpc(), 1);
    assertEquals(llamadasRoles(), 0);
  });
}
