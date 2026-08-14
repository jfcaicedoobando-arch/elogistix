/**
 * Ola 13 · R4EF-03 — invite/reset-password deben pasar por check_ratelimit
 * ANTES de llamar a GoTrue. Inspección de fuente.
 * Run: deno test --no-check supabase/functions/user-management/ratelimit_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const src = await Deno.readTextFile(new URL("./inviteHandler.ts", import.meta.url));

Deno.test("R4EF-03: invite aplica check_ratelimit fail-closed antes de inviteUserByEmail", () => {
  const ini = src.indexOf("export async function handleInvite");
  const fin = src.indexOf("export async function handleResetPassword");
  assert(ini >= 0 && fin > ini, "no se localizó handleInvite");
  const bloque = src.slice(ini, fin);
  const iRl = bloque.indexOf("checkRateLimitCorreo");
  const iSend = bloque.indexOf("inviteUserByEmail");
  assert(iRl >= 0 && iSend > iRl, "el rate limit debe ir antes del envío");
  assertStringIncludes(bloque, "user-management:invite:");
});

Deno.test("R4EF-03: reset-password aplica el tope por usuario antes de resetPasswordForEmail", () => {
  const bloque = src.slice(src.indexOf("export async function handleResetPassword"));
  const iRl = bloque.indexOf("checkRateLimitCorreo");
  const iSend = bloque.indexOf("resetPasswordForEmail");
  assert(iRl >= 0 && iSend > iRl, "el rate limit debe ir antes del envío");
  assertStringIncludes(bloque, "user-management:reset:");
});

Deno.test("R4EF-03: fail-closed con Sentry (patrón REF-07)", () => {
  assertStringIncludes(src, "check_ratelimit");
  assertStringIncludes(src, "captureEdgeException");
  assertStringIncludes(src, "check_ratelimit failed");
  assertStringIncludes(src, "rate_limit_unavailable");
  assertStringIncludes(src, "429");
});
