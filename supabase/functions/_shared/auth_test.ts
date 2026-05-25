/**
 * Deno tests para `_shared/auth.ts` (Sprint T2).
 * `checkAdminAccess` recibe el SupabaseClient como argumento, así que lo
 * mockeamos en memoria sin necesidad de red ni dotenv.
 *
 * Run: deno test supabase/functions/_shared/auth_test.ts --allow-env --allow-net
 */
// @ts-nocheck — Deno runtime, no TS lib en Node CI.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkAdminAccess } from "./auth.ts";

interface QueryResult { data: unknown; error: null }

function makeClient(rows: Record<string, QueryResult>) {
  // Construye un cliente que devuelve la fila configurada según la tabla
  // y la cadena de filtros (sólo importa la tabla, los filtros se ignoran).
  return {
    from(table: string) {
      const res = rows[table] ?? { data: null, error: null };
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        limit: () => chain,
        maybeSingle: () => Promise.resolve(res),
      };
      return chain;
    },
  };
}

Deno.test("checkAdminAccess: super_admin global → isGlobalAdmin=true", async () => {
  const client = makeClient({
    user_roles: { data: { role: "super_admin" }, error: null },
    organization_members: { data: { organization_id: "org-1" }, error: null },
  });
  const r = await checkAdminAccess(client as never, "user-1");
  assertEquals(r.isGlobalAdmin, true);
  assertEquals(r.orgId, "org-1");
});

Deno.test("checkAdminAccess: admin de org → isGlobalAdmin=false, orgId set", async () => {
  const client = makeClient({
    user_roles: { data: null, error: null },
    organization_members: { data: { role: "admin", organization_id: "org-2" }, error: null },
  });
  const r = await checkAdminAccess(client as never, "user-2");
  assertEquals(r.isGlobalAdmin, false);
  assertEquals(r.orgId, "org-2");
});

Deno.test("checkAdminAccess: operador sin rol admin → orgId=null", async () => {
  const client = makeClient({
    user_roles: { data: null, error: null },
    organization_members: { data: null, error: null },
  });
  const r = await checkAdminAccess(client as never, "user-3");
  assertEquals(r.isGlobalAdmin, false);
  assertEquals(r.orgId, null);
});
