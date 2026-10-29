/** Los destinos de body no llegan a Auth ni SQL si no son UUID completos. */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleDelete } from "./deleteHandler.ts";
import { handleSetActive } from "./setActiveHandler.ts";
import type { AdminAccess, HandlerCtx } from "./types.ts";

const CALLER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";
const ORG_ID = "33333333-3333-4333-8333-333333333333";
const ADMINS: AdminAccess[] = [
  { isGlobalAdmin: false, orgId: ORG_ID },
  { isGlobalAdmin: true, orgId: null },
];
const ACTIONS = [
  { name: "delete", handler: handleDelete, extra: {} },
  { name: "activar", handler: handleSetActive, extra: { activo: true } },
  { name: "desactivar", handler: handleSetActive, extra: { activo: false } },
];
const INVALID_IDS: unknown[] = [
  undefined, null, "", 0, 123, false, true, [], [TARGET_ID], {},
  "not-a-uuid", "../logout", "../../admin/users", "%2e%2e%2flogout",
  `${TARGET_ID}/../logout`, `${TARGET_ID}?redirect_to=/logout`, `${TARGET_ID}#fragment`,
  ` ${TARGET_ID}`, `${TARGET_ID}\n`, `${TARGET_ID}\u0000`,
];

function makeCtx(body: Record<string, unknown>) {
  const calls: string[] = [];
  const logs: Array<{ status: number; event: string; meta?: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      calls.push(table);
      throw new Error("Un destino inválido no debe alcanzar SQL");
    },
    auth: {
      admin: {
        deleteUser: async (_id: string) => {
          calls.push("deleteUser");
          return { error: null };
        },
        updateUserById: async (_id: string, _attributes: unknown) => {
          calls.push("updateUserById");
          return { error: null };
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

for (const action of ACTIONS) {
  for (const admin of ADMINS) {
    for (const [index, userId] of INVALID_IDS.entries()) {
      Deno.test(`${action.name}: UUID inválido ${index} se bloquea antes de I/O (global=${admin.isGlobalAdmin})`, async () => {
        const fixture = makeCtx({ ...action.extra, user_id: userId });
        const response = await action.handler(fixture.ctx, admin);
        assertEquals(response.status, 400);
        assertEquals(fixture.calls, []);
        assertEquals(fixture.logs.length, 1);
        assertEquals(fixture.logs[0].status, 400);
        assertEquals(fixture.logs[0].meta, { user_id: CALLER_ID });
        assertEquals(response.headers.get("Access-Control-Allow-Origin"), fixture.ctx.cors["Access-Control-Allow-Origin"]);
        const payload = await response.json();
        assertEquals(typeof payload.error, "string");
        if (typeof userId === "string" && userId.length > 0) {
          assertEquals(payload.error.includes(userId), false);
        }
      });
    }
  }

  Deno.test(`${action.name}: conserva 403 sin acceso administrativo`, async () => {
    const fixture = makeCtx({ ...action.extra, user_id: TARGET_ID });
    const response = await action.handler(fixture.ctx, { isGlobalAdmin: false, orgId: null });
    assertEquals(response.status, 403);
    assertEquals(fixture.calls, []);
  });
}
