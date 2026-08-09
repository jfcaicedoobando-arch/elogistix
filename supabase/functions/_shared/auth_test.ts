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

Deno.test("checkAdminAccess: userId vacío → no es admin", async () => {
  const client = makeClient({
    user_roles: { data: null, error: null },
    organization_members: { data: null, error: null },
  });
  const r = await checkAdminAccess(client as never, "");
  assertEquals(r.isGlobalAdmin, false);
  assertEquals(r.orgId, null);
});

// ── authorizeOrgRole (Ola 4: rol efectivo por organización) ─────────────────
import { authorizeOrgRole } from "./auth.ts";

/**
 * Cliente que distingue las dos consultas a `user_roles` (super_admin vs.
 * fallback global) y la de `organization_members`.
 */
function makeOrgClient(opts: {
  superAdmin?: boolean;
  memberRole?: string | null;
  memberExists?: boolean;
  globalRole?: string | null;
}) {
  return {
    from(table: string) {
      let esSuperQuery = false;
      const chain = {
        select: () => chain,
        eq: (col: string, val: string) => {
          if (table === "user_roles" && col === "role" && val === "super_admin") esSuperQuery = true;
          return chain;
        },
        in: () => chain,
        limit: () => chain,
        maybeSingle: () => {
          if (table === "user_roles") {
            if (esSuperQuery) return Promise.resolve({ data: opts.superAdmin ? { role: "super_admin" } : null, error: null });
            return Promise.resolve({ data: opts.globalRole ? { role: opts.globalRole } : null, error: null });
          }
          if (opts.memberExists === false) return Promise.resolve({ data: null, error: null });
          return Promise.resolve({ data: { role: opts.memberRole ?? null }, error: null });
        },
      };
      return chain;
    },
  };
}

Deno.test("authorizeOrgRole: super_admin global → permitido", async () => {
  const ok = await authorizeOrgRole(makeOrgClient({ superAdmin: true }) as never, "u1", "org-1", ["admin"]);
  assertEquals(ok, true);
});

Deno.test("authorizeOrgRole: admin global demovido en la org → denegado", async () => {
  const ok = await authorizeOrgRole(
    makeOrgClient({ memberRole: "viewer", globalRole: "admin" }) as never,
    "u2", "org-1", ["admin", "contador"],
  );
  assertEquals(ok, false);
});

Deno.test("authorizeOrgRole: rol de org permitido → permitido", async () => {
  const ok = await authorizeOrgRole(
    makeOrgClient({ memberRole: "contador" }) as never,
    "u3", "org-1", ["admin", "contador"],
  );
  assertEquals(ok, true);
});

Deno.test("authorizeOrgRole: super_admin como rol de org se ignora y cae al rol global", async () => {
  const denegado = await authorizeOrgRole(
    makeOrgClient({ memberRole: "super_admin", globalRole: null }) as never,
    "u4", "org-1", ["admin"],
  );
  assertEquals(denegado, false);
  const permitido = await authorizeOrgRole(
    makeOrgClient({ memberRole: "super_admin", globalRole: "admin" }) as never,
    "u5", "org-1", ["admin"],
  );
  assertEquals(permitido, true);
});

Deno.test("authorizeOrgRole: sin membresía → denegado", async () => {
  const ok = await authorizeOrgRole(
    makeOrgClient({ memberExists: false, globalRole: "admin" }) as never,
    "u6", "org-1", ["admin"],
  );
  assertEquals(ok, false);
});
