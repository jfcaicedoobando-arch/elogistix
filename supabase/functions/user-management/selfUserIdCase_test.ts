/** UUID identifica la misma cuenta sin importar mayúsculas/minúsculas. */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleDelete } from "./deleteHandler.ts";
import { handleSetActive } from "./setActiveHandler.ts";
import type { AdminAccess, HandlerCtx } from "./types.ts";

const CALLER_ID = "abcdefab-cdef-4abc-8def-abcdefabcdef";
const ADMINS: AdminAccess[] = [
  { isGlobalAdmin: false, orgId: "33333333-3333-4333-8333-333333333333" },
  { isGlobalAdmin: true, orgId: null },
];
const ACTIONS = [
  { name: "delete", handler: handleDelete, extra: {}, event: "self_delete_blocked", error: "No puedes eliminar tu propia cuenta" },
  { name: "activar", handler: handleSetActive, extra: { activo: true }, event: "self_deactivate_blocked", error: "No puedes desactivar tu propia cuenta" },
  { name: "desactivar", handler: handleSetActive, extra: { activo: false }, event: "self_deactivate_blocked", error: "No puedes desactivar tu propia cuenta" },
];

for (const action of ACTIONS) {
  for (const admin of ADMINS) {
    Deno.test(`${action.name}: propia cuenta con UUID uppercase se bloquea antes de I/O (global=${admin.isGlobalAdmin})`, async () => {
      const calls: string[] = [];
      const logs: Array<{ status: number; event: string; meta?: Record<string, unknown> }> = [];
      const rejectIo = (operation: string) => {
        calls.push(operation);
        throw new Error("La propia cuenta no debe alcanzar SQL ni Auth");
      };
      const client = {
        from: (_table: string) => rejectIo("SQL"),
        auth: { admin: {
          deleteUser: (_id: string) => rejectIo("deleteUser"),
          updateUserById: (_id: string, _attrs: unknown) => rejectIo("updateUserById"),
        } },
      };
      const ctx: HandlerCtx = {
        req: new Request("http://localhost", { method: "POST" }),
        cors: { "Access-Control-Allow-Origin": "https://librecarga.com", Vary: "Origin" },
        log: { finish: (status, event, meta) => logs.push({ status, event, meta }) },
        callerId: CALLER_ID,
        adminClient: client as unknown as HandlerCtx["adminClient"],
        body: { ...action.extra, user_id: CALLER_ID.toUpperCase() },
      };
      const response = await action.handler(ctx, admin);
      assertEquals(response.status, 400);
      assertEquals(await response.json(), { error: action.error });
      assertEquals(calls, []);
      assertEquals(logs, [{ status: 400, event: action.event, meta: { user_id: CALLER_ID } }]);
      assertEquals(response.headers.get("Access-Control-Allow-Origin"), ctx.cors["Access-Control-Allow-Origin"]);
    });
  }
}
