/**
 * DEFECTO 10 — cobertura por rol de `action=list` y `action=list-nombres`.
 *
 * `action=list` (con email/last_sign_in/email_confirmed) sólo debe ser
 * accesible para roles administrativos. `action=list-nombres` (sólo
 * `{id, full_name}`) es la variante segura para roles operativos.
 * Run: deno test --no-check supabase/functions/user-management/rolesAcceso_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleList } from "./listHandler.ts";
import { handleListNombres } from "./listNombresHandler.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { HandlerCtx, AdminAccess } from "./types.ts";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";

const USERS = [
  {
    id: CALLER_ID,
    email: "caller@example.com",
    created_at: "2024-01-01T00:00:00Z",
    last_sign_in_at: "2024-01-02T00:00:00Z",
    confirmed_at: "2024-01-01T00:00:00Z",
    user_metadata: { full_name: "Caller Persona" },
  },
];

/** Cliente admin simulado: resuelve roles del caller y el listado de auth.users. */
function makeAdminClient(role: string) {
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: string) {
              return Promise.resolve({ data: [{ role }] });
            },
          };
        },
      };
    },
    auth: {
      admin: {
        listUsers: async ({ page }: { page: number }) => {
          if (page === 1) return { data: { users: USERS }, error: null };
          return { data: { users: [] }, error: null };
        },
      },
    },
  };
}

function makeCtx(role: string): HandlerCtx {
  const finished: Array<{ status: number; event: string }> = [];
  return {
    req: new Request("http://localhost", { method: "POST" }),
    cors: {},
    log: { finish: (status, event) => finished.push({ status, event }) },
    callerId: CALLER_ID,
    adminClient: makeAdminClient(role) as unknown as SupabaseClient,
    body: {},
  };
}

const ADMIN_GLOBAL: AdminAccess = { isGlobalAdmin: true, orgId: null };

const ROLES_ADMIN_LIST = ["admin", "admin_org", "super_admin"];
const ROLES_OPERATIVOS_DENEGADOS_LIST = [
  "operador",
  "coordinador_logistico",
  "ejecutivo_pricing",
  "gerente_operaciones",
];

for (const role of ROLES_ADMIN_LIST) {
  Deno.test(`action=list: autorizado para rol administrativo "${role}"`, async () => {
    const res = await handleList(makeCtx(role), ADMIN_GLOBAL);
    assertEquals(res.status, 200);
  });
}

for (const role of ROLES_OPERATIVOS_DENEGADOS_LIST) {
  Deno.test(`action=list: DENEGADO para rol operativo "${role}"`, async () => {
    const res = await handleList(makeCtx(role), ADMIN_GLOBAL);
    assertEquals(res.status, 403);
  });
}

const ROLES_LIST_NOMBRES_PERMITIDOS = [
  "admin",
  "admin_org",
  "super_admin",
  "operador",
  "coordinador_logistico",
  "ejecutivo_pricing",
  "gerente_operaciones",
  "contador",
  "tesorero",
  "gerente_comercial",
  "gerente_visor",
  "viewer",
  "customer_service",
];

for (const role of ROLES_LIST_NOMBRES_PERMITIDOS) {
  Deno.test(`action=list-nombres: autorizado para rol operativo "${role}" y sin datos sensibles`, async () => {
    const res = await handleListNombres(makeCtx(role), ADMIN_GLOBAL);
    assertEquals(res.status, 200);
    const body = await res.json();
    assert(Array.isArray(body));
    for (const row of body) {
      assertEquals(Object.keys(row).sort(), ["full_name", "id"]);
      assert(!("email" in row), "list-nombres no debe exponer email");
      assert(!("last_sign_in_at" in row), "list-nombres no debe exponer last_sign_in_at");
      assert(!("email_confirmed_at" in row), "list-nombres no debe exponer email_confirmed_at");
    }
  });
}

Deno.test('action=list-nombres: DENEGADO para rol sin ningún acceso ("vendedor" fuera de la lista)', async () => {
  const res = await handleListNombres(makeCtx("rol_inexistente"), ADMIN_GLOBAL);
  assertEquals(res.status, 403);
});
