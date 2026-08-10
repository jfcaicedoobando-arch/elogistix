/**
 * Deno tests para validaciones puras de `user-management`.
 * Run: deno test supabase/functions/user-management/validate_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseAction } from "./index.ts";
import { validateCreatePayload, resolveRedirectTo } from "./handlers.ts";

Deno.test("parseAction: acepta acciones válidas", () => {
  for (const a of ["list", "create", "delete", "invite-client", "list-clients"]) {
    assertEquals(parseAction({ action: a }), a);
  }
});

Deno.test("parseAction: rechaza acción desconocida", () => {
  assertEquals(parseAction({ action: "wipe" }), null);
  assertEquals(parseAction({}), null);
  assertEquals(parseAction(null), null);
});

Deno.test("validateCreatePayload: rechaza sin email", () => {
  assertEquals(validateCreatePayload({ password: "abcdef" }), "Email y contraseña son requeridos");
});

Deno.test("validateCreatePayload: rechaza sin password", () => {
  assertEquals(validateCreatePayload({ email: "a@b.com" }), "Email y contraseña son requeridos");
});

Deno.test("validateCreatePayload: rechaza password corta (<10)", () => {
  assertEquals(
    validateCreatePayload({ email: "a@b.com", password: "123456789" }),
    "La contraseña debe tener al menos 10 caracteres",
  );
});

Deno.test("validateCreatePayload: acepta payload válido", () => {
  assertEquals(validateCreatePayload({ email: "a@b.com", password: "secret1234" }), null);
});

Deno.test("resolveRedirectTo: usa fallback para origen no permitido", () => {
  assertEquals(resolveRedirectTo("https://evil.com"), "https://elogistix.lovable.app/portal/login");
});

Deno.test("resolveRedirectTo: permite localhost", () => {
  assertEquals(resolveRedirectTo("http://localhost:8080"), "http://localhost:8080/portal/login");
});

Deno.test("resolveRedirectTo: permite localhost sin puerto", () => {
  assertEquals(resolveRedirectTo("http://localhost"), "http://localhost/portal/login");
});

Deno.test("resolveRedirectTo: permite preview oficial allow-listado", () => {
  const ok = "https://id-preview--341dfc00-0308-4aba-9246-e4b2041e31f1.lovable.app";
  assertEquals(resolveRedirectTo(ok), `${ok}/portal/login`);
});

Deno.test("resolveRedirectTo: rechaza http no-localhost (downgrade attack)", () => {
  assertEquals(resolveRedirectTo("http://elogistix.lovable.app"), "https://elogistix.lovable.app/portal/login");
});

Deno.test("resolveRedirectTo: rechaza string vacío", () => {
  assertEquals(resolveRedirectTo(""), "https://elogistix.lovable.app/portal/login");
});

