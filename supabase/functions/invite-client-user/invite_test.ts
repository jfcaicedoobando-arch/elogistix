// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseBody, resolveRedirectTo } from "./index.ts";

// ── parseBody ────────────────────────────────────────────────
Deno.test("parseBody: null → null", () => {
  assertEquals(parseBody(null), null);
});

Deno.test("parseBody: campos faltantes → null", () => {
  assertEquals(parseBody({ email: "a@b.com" }), null);
});

Deno.test("parseBody: email no string → null", () => {
  assertEquals(parseBody({ email: 123, cliente_id: "c", organization_id: "o" }), null);
});

Deno.test("parseBody: payload completo → objeto válido", () => {
  assertEquals(
    parseBody({ email: "a@b.com", cliente_id: "cli-1", organization_id: "org-1" }),
    { email: "a@b.com", cliente_id: "cli-1", organization_id: "org-1" },
  );
});

// ── resolveRedirectTo (anti open-redirect) ──────────────────
Deno.test("resolveRedirectTo: producción permitida → usa ese origin", () => {
  assertEquals(
    resolveRedirectTo("https://elogistix.lovable.app"),
    "https://elogistix.lovable.app/portal/login",
  );
});

Deno.test("resolveRedirectTo: preview Lovable permitido → usa ese origin", () => {
  assertEquals(
    resolveRedirectTo("https://id-preview--341dfc00-0308-4aba-9246-e4b2041e31f1.lovable.app"),
    "https://id-preview--341dfc00-0308-4aba-9246-e4b2041e31f1.lovable.app/portal/login",
  );
});

Deno.test("resolveRedirectTo: localhost con puerto → permitido", () => {
  assertEquals(
    resolveRedirectTo("http://localhost:5173"),
    "http://localhost:5173/portal/login",
  );
});

Deno.test("resolveRedirectTo: localhost sin puerto → permitido", () => {
  assertEquals(
    resolveRedirectTo("http://localhost"),
    "http://localhost/portal/login",
  );
});

Deno.test("resolveRedirectTo: origin no permitido → fallback a producción", () => {
  assertEquals(
    resolveRedirectTo("https://evil.com"),
    "https://elogistix.lovable.app/portal/login",
  );
});

Deno.test("resolveRedirectTo: origin vacío → fallback a producción", () => {
  assertEquals(
    resolveRedirectTo(""),
    "https://elogistix.lovable.app/portal/login",
  );
});
