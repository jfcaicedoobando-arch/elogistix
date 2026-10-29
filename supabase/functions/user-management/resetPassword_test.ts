/** Regresiones de reset-password: clientes simulados, sin envíos ni backend. */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleResetPassword } from "./inviteHandler.ts";
import type { AdminAccess, HandlerCtx } from "./types.ts";

const CALLER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";
const ORG_ID = "33333333-3333-4333-8333-333333333333";
const ORG_ADMIN: AdminAccess = { isGlobalAdmin: false, orgId: ORG_ID };
const GLOBAL_ADMIN: AdminAccess = { isGlobalAdmin: true, orgId: null };

function makeCtx(body: Record<string, unknown>, options: { found?: boolean; member?: boolean } = {}) {
  const calls = { lookups: [] as string[], memberships: [] as string[], rateLimits: [] as string[] };
  const logs: Array<{ status: number; event: string; meta?: Record<string, unknown> }> = [];
  const client = {
    auth: {
      admin: {
        getUserById: async (id: string) => {
          calls.lookups.push(id);
          return {
            data: { user: options.found ? { id, email: "test@example.invalid" } : null },
            error: null,
          };
        },
      },
    },
    from(table: string) {
      assertEquals(table, "organization_members");
      return {
        select(columns: string) {
          assertEquals(columns, "user_id");
          return {
            eq(column: string, id: string) {
              assertEquals(column, "user_id");
              calls.memberships.push(id);
              return {
                eq(orgColumn: string, orgId: string) {
                  assertEquals([orgColumn, orgId], ["organization_id", ORG_ID]);
                  return {
                    maybeSingle: async () => ({ data: options.member ? { user_id: id } : null }),
                  };
                },
              };
            },
          };
        },
      };
    },
    rpc(name: string, args: { p_key: string; p_window_seconds: number; p_max: number }) {
      assertEquals(name, "check_ratelimit");
      assertEquals([args.p_window_seconds, args.p_max], [3600, 3]);
      calls.rateLimits.push(args.p_key);
      // Cortar antes de construir el cliente anónimo o enviar correo.
      return Promise.resolve({ data: { ok: false, retry_after: 60 }, error: null });
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

const INVALID_IDS: unknown[] = [
  undefined, null, "", 0, 123, false, true, [], [TARGET_ID], {},
  "not-a-uuid", "../logout", "../../admin/users", "%2e%2e%2flogout",
  `${TARGET_ID}/../logout`, `${TARGET_ID}?redirect_to=/logout`, `${TARGET_ID}#fragment`,
  ` ${TARGET_ID}`, `${TARGET_ID}\n`, `${TARGET_ID}\u0000`,
];

for (const [index, userId] of INVALID_IDS.entries()) {
  Deno.test(`reset-password rechaza destino inválido ${index} antes de Auth, SQL o rate limit`, async () => {
    const fixture = makeCtx({ user_id: userId });
    const response = await handleResetPassword(fixture.ctx, GLOBAL_ADMIN);
    assertEquals(response.status, 400);
    assertEquals(fixture.calls, { lookups: [], memberships: [], rateLimits: [] });
    assertEquals(fixture.logs, [{ status: 400, event: "validation_failed", meta: { user_id: CALLER_ID } }]);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), fixture.ctx.cors["Access-Control-Allow-Origin"]);
    const payload = await response.json();
    assertEquals(typeof payload.error, "string");
    if (typeof userId === "string" && userId.length > 0) {
      assertEquals(payload.error.includes(userId), false);
    }
  });
}

for (const userId of [TARGET_ID, "ABCDEFAB-1234-4ABC-8DEF-1234567890AB"]) {
  Deno.test(`reset-password conserva UUID válido ${userId} y respuesta 404 sin destino`, async () => {
    const fixture = makeCtx({ user_id: userId });
    const response = await handleResetPassword(fixture.ctx, GLOBAL_ADMIN);
    assertEquals(response.status, 404);
    assertEquals(await response.json(), { error: "Usuario no encontrado" });
    assertEquals(fixture.calls, { lookups: [userId], memberships: [], rateLimits: [] });
  });
}

Deno.test("reset-password conserva denegación sin permisos antes de consultar Auth", async () => {
  const fixture = makeCtx({ user_id: TARGET_ID });
  const response = await handleResetPassword(fixture.ctx, { isGlobalAdmin: false, orgId: null });
  assertEquals(response.status, 403);
  assertEquals(fixture.calls, { lookups: [], memberships: [], rateLimits: [] });
});

Deno.test("reset-password conserva aislamiento de organización antes del rate limit", async () => {
  const fixture = makeCtx({ user_id: TARGET_ID }, { found: true, member: false });
  const response = await handleResetPassword(fixture.ctx, ORG_ADMIN);
  assertEquals(response.status, 403);
  assertEquals(await response.json(), { error: "El usuario no pertenece a tu organización" });
  assertEquals(fixture.calls, { lookups: [TARGET_ID], memberships: [TARGET_ID], rateLimits: [] });
});

for (const admin of [ORG_ADMIN, GLOBAL_ADMIN]) {
  Deno.test(`reset-password conserva tope por destino y 429 para global=${admin.isGlobalAdmin}`, async () => {
    const fixture = makeCtx({ user_id: TARGET_ID }, { found: true, member: true });
    const response = await handleResetPassword(fixture.ctx, admin);
    assertEquals(response.status, 429);
    assertEquals(response.headers.get("Retry-After"), "60");
    assertEquals(fixture.calls, {
      lookups: [TARGET_ID],
      memberships: admin.isGlobalAdmin ? [] : [TARGET_ID],
      rateLimits: [`user-management:reset:${TARGET_ID}`],
    });
  });
}
