// @ts-nocheck
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseRequest, corsResponse } from "./validation.ts";

const URL = "https://example.com/send";

function jsonReq(body: unknown): Request {
  return new Request(URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.test("parseRequest: body inválido → 400", async () => {
  const req = new Request(URL, { method: "POST", body: "not-json" });
  const res = await parseRequest(req);
  assert(res instanceof Response);
  assertEquals(res.status, 400);
  await res.text();
});

Deno.test("parseRequest: templateName faltante → 400", async () => {
  const res = await parseRequest(jsonReq({ recipientEmail: "a@b.com" }));
  assert(res instanceof Response);
  assertEquals(res.status, 400);
  await res.text();
});

Deno.test("parseRequest: acepta camelCase y snake_case", async () => {
  const out = await parseRequest(jsonReq({
    template_name: "welcome",
    recipient_email: "x@y.com",
    idempotency_key: "key-1",
    templateData: { a: 1 },
  }));
  assert(!(out instanceof Response));
  assertEquals(out.templateName, "welcome");
  assertEquals(out.recipientEmail, "x@y.com");
  assertEquals(out.idempotencyKey, "key-1");
  assertEquals(out.templateData, { a: 1 });
  assert(typeof out.messageId === "string" && out.messageId.length > 0);
});

Deno.test("parseRequest: idempotencyKey por defecto = messageId", async () => {
  const out = await parseRequest(jsonReq({ templateName: "t" }));
  assert(!(out instanceof Response));
  assertEquals(out.idempotencyKey, out.messageId);
});

Deno.test("parseRequest: templateData no-objeto se descarta", async () => {
  const out = await parseRequest(jsonReq({ templateName: "t", templateData: "nope" }));
  assert(!(out instanceof Response));
  assertEquals(out.templateData, {});
});

Deno.test("corsResponse: status default 200 y JSON válido", async () => {
  const res = corsResponse({ ok: true });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(await res.json(), { ok: true });
});

Deno.test("corsResponse: status custom", async () => {
  const res = corsResponse({ error: "x" }, 500);
  assertEquals(res.status, 500);
  await res.text();
});
