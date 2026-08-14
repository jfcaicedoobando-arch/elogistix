/**
 * Ola 13 · R4EF-05 — guarda estructural: el service key nunca se compara con !==.
 * Run: deno test --no-check supabase/functions/send-transactional-email/index_auth_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("R4EF-05: verifyServiceRoleOrFail usa timingSafeEqual de _shared", () => {
  assertStringIncludes(src, "timingSafeEqual(token, env.supabaseServiceKey)");
  assert(!src.includes("token !== env.supabaseServiceKey"), "quedó comparación con !==");
});
