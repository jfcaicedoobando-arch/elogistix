/** Regresiones del lookup de roles del destino; sólo clientes simulados. */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleDelete } from "./deleteHandler.ts";
import { handleSetActive } from "./setActiveHandler.ts";
import type { AdminAccess, HandlerCtx } from "./types.ts";

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const TARGET_ID = "22222222-2222-2222-2222-222222222222";
const ORG_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_ORG_ID = "44444444-4444-4444-4444-444444444444";
const ORG_ADMIN: AdminAccess = { isGlobalAdmin: false, orgId: ORG_ID };
const GLOBAL_ADMIN: AdminAccess = { isGlobalAdmin: true, orgId: null };
const SAFE_ERROR = "LC_USUARIO_ERROR_INTERNO: No se pudo completar la operación. Intenta de nuevo; si persiste, contacta a soporte.";
const RAW_ERROR = "permission denied for table user_roles; SQLSTATE 42501";

type Roles = Array<{ role: string }> | null;
type Lookup = () => Promise<{ data: Roles; error: { message: string; code: string } | null }>;
type LogEntry = { status: number; event: string; meta?: Record<string, unknown> };

function makeCtx(
  body: Record<string, unknown>,
  lookup: Lookup,
  orgs: string[] = [ORG_ID],
) {
  const calls = {
    lookups: [] as string[],
    updates: [] as Array<{ userId: string; ban_duration: string }>,
    authDeletes: [] as string[],
    tableDeletes: [] as string[],
  };
  const logs: LogEntry[] = [];
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          if (table === "user_roles") {
            assertEquals(columns, "role");
            return {
              eq(column: string, userId: string) {
                assertEquals([column, userId], ["user_id", TARGET_ID]);
                calls.lookups.push(userId);
                return lookup();
              },
            };
          }
          assertEquals(table, "organization_members");
          if (columns === "organization_id") {
            return {
              eq: async () => ({
                data: orgs.map((organization_id) => ({ organization_id })), error: null,
              }),
            };
          }
          assertEquals(columns, "id");
          return {
            eq: () => ({
              eq: (_column: string, orgId: string) => ({
                maybeSingle: async () => ({
                  data: orgs.includes(orgId) ? { id: "membership" } : null, error: null,
                }),
              }),
            }),
          };
        },
        delete() {
          calls.tableDeletes.push(table);
          return {
            eq: async (column: string, userId: string) => {
              assertEquals([column, userId], ["user_id", TARGET_ID]);
              return { error: null };
            },
          };
        },
      };
    },
    auth: {
      admin: {
        updateUserById: async (userId: string, attrs: { ban_duration: string }) => {
          calls.updates.push({ userId, ...attrs });
          return { data: null, error: null };
        },
        deleteUser: async (userId: string) => {
          calls.authDeletes.push(userId);
          return { data: null, error: null };
        },
      },
    },
  };
  const ctx: HandlerCtx = {
    req: new Request("http://localhost", { method: "POST" }),
    cors: { "Access-Control-Allow-Origin": "https://librecarga.com", Vary: "Origin" },
    log: { finish: (status, event, meta) => logs.push({ status, event, meta }) },
    callerId: CALLER_ID,
    adminClient: client as unknown as HandlerCtx["adminClient"],
    body,
  };
  return { ctx, calls, logs };
}

type Fixture = ReturnType<typeof makeCtx>;
const successLookup = (data: Roles): Lookup => () => Promise.resolve({ data, error: null });
const ACTIONS = [
  { name: "delete", handler: handleDelete, body: { user_id: TARGET_ID } },
  { name: "activar", handler: handleSetActive, body: { user_id: TARGET_ID, activo: true } },
  { name: "desactivar", handler: handleSetActive, body: { user_id: TARGET_ID, activo: false } },
];

function assertNoMutations({ calls }: Fixture) {
  assertEquals(calls.updates, []);
  assertEquals(calls.authDeletes, []);
  assertEquals(calls.tableDeletes, []);
}

function assertCors(response: Response, { ctx }: Fixture) {
  for (const [name, value] of Object.entries(ctx.cors)) {
    assertEquals(response.headers.get(name), value);
  }
}

async function assertLookupFailure(response: Response, fixture: Fixture) {
  assertEquals(response.status, 500);
  const body: unknown = await response.json();
  assertEquals(body, { error: SAFE_ERROR });
  assertCors(response, fixture);
  assertNoMutations(fixture);
  assertEquals(fixture.calls.lookups, [TARGET_ID]);
  assertEquals(fixture.logs.length, 1);
  const { status, event, meta } = fixture.logs[0];
  assertEquals([status, event], [500, "target_roles_lookup_failed"]);
  assertEquals(meta?.user_id, CALLER_ID);
  assertEquals(meta?.organization_id, ORG_ID);
  assertEquals((meta?.payload as Record<string, unknown>)?.target_user_id, TARGET_ID);
}

for (const action of ACTIONS) {
  const errorData: Roles[] = [null, [], [{ role: "operador" }], [{ role: "super_admin" }]];
  for (const data of errorData) {
    Deno.test(`${action.name}: error del lookup con data=${JSON.stringify(data)} bloquea toda mutación`, async () => {
      const fixture = makeCtx(action.body, () => Promise.resolve({
        data, error: { message: RAW_ERROR, code: "42501" },
      }));
      await assertLookupFailure(await action.handler(fixture.ctx, ORG_ADMIN), fixture);
    });
  }

  for (const rejection of [new Error(RAW_ERROR), { message: RAW_ERROR }, null]) {
    Deno.test(`${action.name}: rechazo del lookup (${String(rejection)}) devuelve error seguro`, async () => {
      const fixture = makeCtx(action.body, () => Promise.reject(rejection));
      await assertLookupFailure(await action.handler(fixture.ctx, ORG_ADMIN), fixture);
    });
  }

  Deno.test(`${action.name}: super_admin conserva 403 sin mutaciones`, async () => {
    const fixture = makeCtx(action.body, successLookup([{ role: "operador" }, { role: "super_admin" }]));
    const response = await action.handler(fixture.ctx, ORG_ADMIN);
    assertEquals(response.status, 403);
    assertEquals(fixture.logs[0].event, "privesc_blocked_super_admin");
    assertCors(response, fixture);
    assertNoMutations(fixture);
  });

  for (const data of [null, [], [{ role: "admin_org" }, { role: "operador" }]]) {
    Deno.test(`${action.name}: lookup correcto con roles=${JSON.stringify(data)} permite la operación`, async () => {
      const fixture = makeCtx(action.body, successLookup(data));
      const response = await action.handler(fixture.ctx, ORG_ADMIN);
      assertEquals(response.status, 200);
      assertEquals(await response.json(), { success: true });
      assertCors(response, fixture);
      assertEquals(fixture.calls.lookups, [TARGET_ID]);
      if (action.name === "delete") {
        assertEquals(fixture.calls.tableDeletes, ["organization_members", "user_roles"]);
        assertEquals(fixture.calls.authDeletes, [TARGET_ID]);
        assertEquals(fixture.calls.updates, []);
      } else {
        assertEquals(fixture.calls.updates, [{
          userId: TARGET_ID, ban_duration: action.body.activo ? "none" : "876000h",
        }]);
        assertEquals(fixture.calls.authDeletes, []);
        assertEquals(fixture.calls.tableDeletes, []);
      }
    });
  }

  for (const admin of [ORG_ADMIN, GLOBAL_ADMIN]) {
    Deno.test(`${action.name}: self-action sigue bloqueada (global=${admin.isGlobalAdmin})`, async () => {
      const fixture = makeCtx({ ...action.body, user_id: CALLER_ID }, successLookup([]));
      assertEquals((await action.handler(fixture.ctx, admin)).status, 400);
      assertEquals(fixture.calls.lookups, []);
      assertNoMutations(fixture);
    });
  }

  Deno.test(`${action.name}: cross-org sigue bloqueado antes del lookup`, async () => {
    const fixture = makeCtx(action.body, successLookup([]), [OTHER_ORG_ID]);
    assertEquals((await action.handler(fixture.ctx, ORG_ADMIN)).status, 403);
    assertEquals(fixture.calls.lookups, []);
    assertNoMutations(fixture);
  });

  Deno.test(`${action.name}: sin acceso de administrador sigue denegado`, async () => {
    const fixture = makeCtx(action.body, successLookup([]));
    assertEquals((await action.handler(fixture.ctx, { isGlobalAdmin: false, orgId: null })).status, 403);
    assertEquals(fixture.calls.lookups, []);
    assertNoMutations(fixture);
  });

  Deno.test(`${action.name}: administrador global conserva el alcance existente`, async () => {
    const fixture = makeCtx(action.body, () => Promise.reject(new Error("lookup inesperado")), []);
    assertEquals((await action.handler(fixture.ctx, GLOBAL_ADMIN)).status, 200);
    assertEquals(fixture.calls.lookups, []);
    assertEquals(fixture.calls.updates.length + fixture.calls.authDeletes.length, 1);
  });
}

for (const action of ACTIONS.filter((action) => action.name !== "delete")) {
  Deno.test(`${action.name}: multi-org sigue bloqueado antes del lookup`, async () => {
    const fixture = makeCtx(action.body, successLookup([]), [ORG_ID, OTHER_ORG_ID]);
    assertEquals((await action.handler(fixture.ctx, ORG_ADMIN)).status, 403);
    assertEquals(fixture.logs[0].event, "multi_org_blocked");
    assertEquals(fixture.calls.lookups, []);
    assertNoMutations(fixture);
  });
}
