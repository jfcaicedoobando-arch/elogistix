// @ts-nocheck — Deno runtime
/**
 * N51 (Ola 4): rate-limit fail-closed, límite de tamaño de body y llave
 * compuesta IP + x-client-info.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildRateLimitKey, handleClientErrorLog, MAX_BODY_BYTES } from "./index.ts";

function fakeClient(rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  return { rpc: rpcImpl };
}

Deno.test("buildRateLimitKey: combina IP + x-client-info truncado", () => {
  const req = new Request("https://x", {
    headers: { "x-forwarded-for": "1.2.3.4", "x-client-info": "app/1.0" },
  });
  assertEquals(buildRateLimitKey(req), "client-error-log:1.2.3.4:app/1.0");
});

Deno.test("buildRateLimitKey: sin x-client-info usa 'desconocido'", () => {
  const req = new Request("https://x", { headers: { "x-forwarded-for": "9.9.9.9" } });
  assertEquals(buildRateLimitKey(req), "client-error-log:9.9.9.9:desconocido");
});

Deno.test("handleClientErrorLog: Content-Length > 64KB → 413 sin llamar RPC", async () => {
  let rpcCalls = 0;
  const client = fakeClient(async () => {
    rpcCalls++;
    return { data: { ok: true }, error: null };
  });
  const req = new Request("https://x", {
    method: "POST",
    headers: { "content-length": String(MAX_BODY_BYTES + 1) },
  });
  const res = await handleClientErrorLog(req, client, "req-1");
  assertEquals(res.status, 413);
  assertEquals(rpcCalls, 0);
});

Deno.test("handleClientErrorLog: body chunked > 64KB sin Content-Length → 413", async () => {
  const client = fakeClient(async (fn: string) =>
    fn === "check_ratelimit" ? { data: { ok: true }, error: null } : { data: {}, error: null },
  );
  const raw = JSON.stringify({ message: "x".repeat(MAX_BODY_BYTES + 10) });
  const req = new Request("https://x", { method: "POST", body: raw });
  const res = await handleClientErrorLog(req, client, "req-1");
  assertEquals(res.status, 413);
});

Deno.test("handleClientErrorLog: RPC de rate-limit falla → 503 fail-closed (no inserta)", async () => {
  let logInsertCalled = false;
  const client = fakeClient(async (fn: string) => {
    if (fn === "check_ratelimit") return { data: null, error: { message: "boom" } };
    logInsertCalled = true;
    return { data: {}, error: null };
  });
  const req = new Request("https://x", {
    method: "POST",
    body: JSON.stringify({ message: "hola" }),
  });
  const res = await handleClientErrorLog(req, client, "req-1");
  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.error, "rate_limit_unavailable");
  assertEquals(logInsertCalled, false);
});

Deno.test("handleClientErrorLog: rate limit excedido → 429 con Retry-After", async () => {
  const client = fakeClient(async (fn: string) =>
    fn === "check_ratelimit"
      ? { data: { ok: false, retry_after: 42 }, error: null }
      : { data: {}, error: null },
  );
  const req = new Request("https://x", { method: "POST", body: JSON.stringify({ message: "hola" }) });
  const res = await handleClientErrorLog(req, client, "req-1");
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Retry-After"), "42");
});

Deno.test("handleClientErrorLog: flujo normal inserta y responde 200", async () => {
  const client = fakeClient(async (fn: string) =>
    fn === "check_ratelimit"
      ? { data: { ok: true }, error: null }
      : { data: {}, error: null },
  );
  const req = new Request("https://x", { method: "POST", body: JSON.stringify({ message: "hola" }) });
  const res = await handleClientErrorLog(req, client, "req-1");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
});

Deno.test("handleClientErrorLog: JSON inválido → 400", async () => {
  const client = fakeClient(async () => ({ data: { ok: true }, error: null }));
  const req = new Request("https://x", { method: "POST", body: "{no-json" });
  const res = await handleClientErrorLog(req, client, "req-1");
  assertEquals(res.status, 400);
});
