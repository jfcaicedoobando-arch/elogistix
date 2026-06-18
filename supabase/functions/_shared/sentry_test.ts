// @ts-nocheck — Deno test runtime (URLs https://deno.land/...). Vitest lo ignora vía glob.
/**
 * Plan C (audit Sentry): smoke test del wrapper `wrapEdgeHandler`.
 *  - Devuelve la respuesta del handler en happy path.
 *  - Re-lanza el error original cuando el handler tira (sin DSN no se intenta
 *    enviar a Sentry, así que la prueba no necesita red).
 */
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { wrapEdgeHandler } from "./sentry.ts";

Deno.test("wrapEdgeHandler — propaga la respuesta del handler", async () => {
  const handler = wrapEdgeHandler("test-fn-ok", () => new Response("ok", { status: 200 }));
  const res = await handler(new Request("http://x/test"));
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
});

Deno.test("wrapEdgeHandler — re-lanza el error original del handler", async () => {
  const boom = new Error("handler-explota");
  const handler = wrapEdgeHandler("test-fn-fail", () => {
    throw boom;
  });
  await assertRejects(
    () => handler(new Request("http://x/test")),
    Error,
    "handler-explota",
  );
});

Deno.test("wrapEdgeHandler — es idempotente (mismo nombre, dos invocaciones)", async () => {
  const handler = wrapEdgeHandler("test-fn-idem", () => new Response("a"));
  const r1 = await handler(new Request("http://x/1"));
  const r2 = await handler(new Request("http://x/2"));
  assertEquals(await r1.text(), "a");
  assertEquals(await r2.text(), "a");
});
