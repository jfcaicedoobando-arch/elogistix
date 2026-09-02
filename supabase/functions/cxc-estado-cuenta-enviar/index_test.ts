/**
 * Ronda YAGNI · defecto 9 — el estado de cuenta sólo lo envían roles de
 * cobranza/fiscal (`ROLES_COBRANZA_FISCAL`), no cualquier miembro de la org.
 *
 * Run: deno test --no-check --allow-read --allow-net supabase/functions/cxc-estado-cuenta-enviar/index_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { authorizeOrgRole, ROLES_COBRANZA_FISCAL } from "../_shared/auth.ts";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

function makeClient(rows: Record<string, { data: unknown; error: null }>) {
  return {
    from(table: string) {
      const res = rows[table] ?? { data: null, error: null };
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        maybeSingle: () => Promise.resolve(res),
      };
      return chain;
    },
  };
}

Deno.test("defecto 9: la autorización usa rol exacto de cobranza, no membresía", () => {
  assertStringIncludes(src, "ROLES_COBRANZA_FISCAL");
  assert(!src.includes("!!member.data || !!admin.data"), "quedó la autorización por mera membresía");
});

Deno.test("defecto 9: operador y viewer no pasan la autorización", async () => {
  for (const rol of ["operador", "viewer"]) {
    const client = makeClient({
      user_roles: { data: null, error: null },
      organization_members: { data: { role: rol }, error: null },
    });
    assertEquals(
      await authorizeOrgRole(client as never, "u1", "org-1", ROLES_COBRANZA_FISCAL),
      false,
      `${rol} no debe poder enviar cobranza`,
    );
  }
});

Deno.test("defecto 9: ejecutivo_cobranza y contador sí pasan", async () => {
  for (const rol of ["ejecutivo_cobranza", "contador"]) {
    const client = makeClient({
      user_roles: { data: null, error: null },
      organization_members: { data: { role: rol }, error: null },
    });
    assertEquals(
      await authorizeOrgRole(client as never, "u1", "org-1", ROLES_COBRANZA_FISCAL),
      true,
      `${rol} debe poder enviar cobranza`,
    );
  }
});

Deno.test("defecto 9: un miembro de otra organización no pasa", async () => {
  const client = makeClient({
    user_roles: { data: null, error: null },
    organization_members: { data: null, error: null },
  });
  assertEquals(await authorizeOrgRole(client as never, "u1", "org-2", ROLES_COBRANZA_FISCAL), false);
});

Deno.test("defecto 9: la clave del envío es estable (sin Date.now)", () => {
  assert(!/messageId = .*Date\.now\(\)/.test(src), "el message_id sigue dependiendo del reloj");
  assertStringIncludes(src, "messageIdEstadoCuenta(");
  assertStringIncludes(src, "destinatario.toLowerCase()");
  assertStringIncludes(src, "if (await yaEnviado(admin, messageId)) return;");
});
