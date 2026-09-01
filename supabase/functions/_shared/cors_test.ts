/**
 * Deno tests para `_shared/cors.ts` (Tanda A).
 * Verifica whitelist estricta, preflight y headers Vary.
 *
 * Run: deno test supabase/functions/_shared/cors_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCors, handlePreflightStrict, handlePreflight, corsHeaders } from "./cors.ts";

function req(origin: string | null, method = "GET"): Request {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return new Request("https://x.test/fn", { method, headers });
}

Deno.test("buildCors: refleja origin permitido *.lovable.app", () => {
  const c = buildCors(req("https://app.lovable.app"));
  assertEquals(c["Access-Control-Allow-Origin"], "https://app.lovable.app");
  assertEquals(c["Vary"], "Origin");
});

Deno.test("buildCors: refleja localhost:8080 dev", () => {
  const c = buildCors(req("http://localhost:8080"));
  assertEquals(c["Access-Control-Allow-Origin"], "http://localhost:8080");
});

Deno.test("buildCors: rechaza origin desconocido devolviendo 'null'", () => {
  const c = buildCors(req("https://evil.com"));
  assertEquals(c["Access-Control-Allow-Origin"], "null");
});

Deno.test("buildCors: rechaza http no-localhost (solo https permitido)", () => {
  const c = buildCors(req("http://app.lovable.app"));
  assertEquals(c["Access-Control-Allow-Origin"], "null");
});

Deno.test("buildCors: sin origin devuelve 'null'", () => {
  const c = buildCors(req(null));
  assertEquals(c["Access-Control-Allow-Origin"], "null");
});

Deno.test("buildCors: acepta sufijo .lovableproject.com", () => {
  const c = buildCors(req("https://abc.lovableproject.com"));
  assertEquals(c["Access-Control-Allow-Origin"], "https://abc.lovableproject.com");
});

Deno.test("handlePreflightStrict: responde 200 + CORS headers en OPTIONS", () => {
  const res = handlePreflightStrict(req("https://app.lovable.app", "OPTIONS"));
  assert(res);
  assertEquals(res!.status, 200);
  assertEquals(res!.headers.get("Access-Control-Allow-Origin"), "https://app.lovable.app");
});

Deno.test("handlePreflightStrict: null en métodos no-OPTIONS", () => {
  assertEquals(handlePreflightStrict(req("https://app.lovable.app", "POST")), null);
});

Deno.test("handlePreflight (wildcard): responde con * en OPTIONS", () => {
  const res = handlePreflight(req(null, "OPTIONS"));
  assert(res);
  assertEquals(res!.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("corsHeaders: incluye Allow-Headers con tokens supabase", () => {
  assert(corsHeaders["Access-Control-Allow-Headers"].includes("x-supabase-client-platform"));
});

Deno.test("buildCors: acepta dominio custom librecarga.com", () => {
  const c = buildCors(req("https://librecarga.com"));
  assertEquals(c["Access-Control-Allow-Origin"], "https://librecarga.com");
});

Deno.test("buildCors: acepta dominio custom www.librecarga.com", () => {
  const c = buildCors(req("https://www.librecarga.com"));
  assertEquals(c["Access-Control-Allow-Origin"], "https://www.librecarga.com");
});

Deno.test("buildCors: incluye Allow-Methods POST y OPTIONS", () => {
  const c = buildCors(req("https://librecarga.com"));
  assert(c["Access-Control-Allow-Methods"].includes("POST"));
  assert(c["Access-Control-Allow-Methods"].includes("OPTIONS"));
});

Deno.test("buildCors: incluye Max-Age", () => {
  const c = buildCors(req("https://librecarga.com"));
  assertEquals(c["Access-Control-Max-Age"], "86400");
});

Deno.test("corsHeaders: permite headers de Sentry (sentry-trace, baggage)", () => {
  // 13.114.13: regresión — en `librecarga.com` Sentry adjunta estos headers
  // a las llamadas a edge functions; sin permitirlos el navegador cancela
  // el POST después del OPTIONS.
  assert(corsHeaders["Access-Control-Allow-Headers"].includes("sentry-trace"));
  assert(corsHeaders["Access-Control-Allow-Headers"].includes("baggage"));
});

Deno.test("buildCors: permite headers de Sentry desde librecarga.com", () => {
  const c = buildCors(req("https://librecarga.com"));
  assert(c["Access-Control-Allow-Headers"].includes("sentry-trace"));
  assert(c["Access-Control-Allow-Headers"].includes("baggage"));
});

Deno.test("preflight permite x-organization-id (contrato CxP)", () => {
  // v13.823.4: la organización objetivo viaja en header para autorizar antes
  // de leer el multipart; sin este header en el preflight el navegador cancela.
  const res = handlePreflightStrict(req("https://librecarga.com", "OPTIONS"));
  assert(res);
  assert(
    res!.headers.get("Access-Control-Allow-Headers")!.includes(
      "x-organization-id",
    ),
  );
  assert(corsHeaders["Access-Control-Allow-Headers"].includes("x-organization-id"));
});
