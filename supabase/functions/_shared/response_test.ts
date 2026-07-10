import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { jsonResponse, errorResponse } from "./response.ts";
import { corsHeaders } from "./cors.ts";

Deno.test("jsonResponse: por defecto status 200 y CORS wildcard + JSON content-type", async () => {
  const res = jsonResponse({ ok: true });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), corsHeaders["Access-Control-Allow-Origin"]);
  assertEquals(await res.json(), { ok: true });
});

Deno.test("jsonResponse: acepta status custom", async () => {
  const res = jsonResponse({ error: "not_found" }, 404);
  assertEquals(res.status, 404);
  assertEquals(await res.json(), { error: "not_found" });
});

Deno.test("jsonResponse: aplica CORS strict pasado desde buildCors", async () => {
  const strictCors = { "Access-Control-Allow-Origin": "https://app.example.com" };
  const res = jsonResponse({ ok: true }, 200, strictCors);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "https://app.example.com");
  assertEquals(res.headers.get("Content-Type"), "application/json");
});

Deno.test("errorResponse: shape { error } con status 500 por defecto", async () => {
  const res = errorResponse("boom");
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: "boom" });
});

Deno.test("errorResponse: acepta status custom", async () => {
  const res = errorResponse("unauthorized", 401);
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: "unauthorized" });
});
