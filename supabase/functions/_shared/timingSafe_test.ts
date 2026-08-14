/**
 * Ola 13 · R4EF-05 — contrato del comparador constante en tiempo.
 * Run: deno test --no-check supabase/functions/_shared/timingSafe_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { timingSafeEqual } from "./timingSafe.ts";

Deno.test("timingSafeEqual: iguales => true, distintos => false, distinta longitud => false", () => {
  assertEquals(timingSafeEqual("secret-key-123", "secret-key-123"), true);
  assertEquals(timingSafeEqual("secret-key-123", "secret-key-124"), false);
  assertEquals(timingSafeEqual("secret-key-123", "secret-key-12"), false);
  assertEquals(timingSafeEqual("", ""), true);
});
