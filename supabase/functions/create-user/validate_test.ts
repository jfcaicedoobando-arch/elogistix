/**
 * Deno tests para `validatePayload` de create-user (Sprint T2).
 * Run: deno test supabase/functions/create-user/validate_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validatePayload } from "./index.ts";

Deno.test("validatePayload: rechaza sin email", () => {
  assertEquals(
    validatePayload({ password: "abcdef" }),
    "Email y contraseña son requeridos",
  );
});

Deno.test("validatePayload: rechaza sin password", () => {
  assertEquals(
    validatePayload({ email: "a@b.com" }),
    "Email y contraseña son requeridos",
  );
});

Deno.test("validatePayload: rechaza password corta (<6)", () => {
  assertEquals(
    validatePayload({ email: "a@b.com", password: "12345" }),
    "La contraseña debe tener al menos 6 caracteres",
  );
});

Deno.test("validatePayload: acepta payload válido", () => {
  assertEquals(
    validatePayload({ email: "a@b.com", password: "secret123" }),
    null,
  );
});
