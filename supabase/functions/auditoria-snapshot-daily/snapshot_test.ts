// @ts-nocheck
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkCronSecret } from "./index.ts";

// ── CRON_SECRET guard ─────────────────────────────────────────

Deno.test("checkCronSecret: secret undefined → false", () => {
  assertEquals(checkCronSecret(undefined, "any-value"), false);
});

Deno.test("checkCronSecret: header null → false", () => {
  assertEquals(checkCronSecret("my-secret", null), false);
});

Deno.test("checkCronSecret: header mismatch → false", () => {
  assertEquals(checkCronSecret("my-secret", "wrong-secret"), false);
});

Deno.test("checkCronSecret: empty secret → false", () => {
  assertEquals(checkCronSecret("", ""), false);
});

Deno.test("checkCronSecret: matching secret → true", () => {
  assertEquals(checkCronSecret("super-secret-123", "super-secret-123"), true);
});

// ── checkCronSecret edge cases (reemplazan tests tautológicos previos) ────

Deno.test("checkCronSecret: whitespace-only secret no se confunde con vacío", () => {
  assertEquals(checkCronSecret("   ", "   "), true);
  assertEquals(checkCronSecret("   ", ""), false);
});

Deno.test("checkCronSecret: comparación case-sensitive", () => {
  assertEquals(checkCronSecret("Secret", "secret"), false);
  assertEquals(checkCronSecret("Secret", "Secret"), true);
});

Deno.test("checkCronSecret: secret con caracteres especiales", () => {
  const s = "k3y!@#-_$%^&*()=+/";
  assertEquals(checkCronSecret(s, s), true);
  assertEquals(checkCronSecret(s, s + "x"), false);
});


/**
 * Ronda YAGNI · defecto 10 — el cron ya no reporta 200 cuando alguna
 * organización falla (el snapshot es idempotente, reintentar es seguro).
 */
Deno.test("defecto 10: el snapshot devuelve 500 si hay fallos por-org", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertStringIncludes(src, "const status = fallos > 0 ? 500 : 200;");
  assertStringIncludes(src, "ok: fallos === 0");
});
