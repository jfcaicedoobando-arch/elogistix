// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractToken } from "./tokenExtractor.ts";

const URL_WITH = "https://example.com/u?token=abc123";
const URL_WITHOUT = "https://example.com/u";

Deno.test("extractToken: GET con query param", async () => {
  const req = new Request(URL_WITH, { method: "GET" });
  assertEquals(await extractToken(req), "abc123");
});

Deno.test("extractToken: GET sin query param → null", async () => {
  const req = new Request(URL_WITHOUT, { method: "GET" });
  assertEquals(await extractToken(req), null);
});

Deno.test("extractToken: POST JSON con token en body gana", async () => {
  const req = new Request(URL_WITH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "from-body" }),
  });
  assertEquals(await extractToken(req), "from-body");
});

Deno.test("extractToken: POST JSON inválido → cae al query param", async () => {
  const req = new Request(URL_WITH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json",
  });
  assertEquals(await extractToken(req), "abc123");
});

Deno.test("extractToken: POST form RFC 8058 (List-Unsubscribe) usa query param", async () => {
  const req = new Request(URL_WITH, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  });
  assertEquals(await extractToken(req), "abc123");
});

Deno.test("extractToken: POST form con token explícito", async () => {
  const req = new Request(URL_WITHOUT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "token=form-tok",
  });
  assertEquals(await extractToken(req), "form-tok");
});
