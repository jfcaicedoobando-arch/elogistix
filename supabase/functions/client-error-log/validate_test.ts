// @ts-nocheck — Deno runtime
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getClientIp, truncate } from "./index.ts";

Deno.test("truncate: null/undefined → null", () => {
  assertEquals(truncate(null, 100), null);
  assertEquals(truncate(undefined, 100), null);
});

Deno.test("truncate: string corta sin cambios", () => {
  assertEquals(truncate("hola", 100), "hola");
});

Deno.test("truncate: string larga se corta", () => {
  assertEquals(truncate("x".repeat(50), 10), "x".repeat(10));
});

Deno.test("truncate: objeto → JSON.stringify y corte", () => {
  const result = truncate({ a: 1, b: 2 }, 5);
  assertEquals(result?.length, 5);
});

Deno.test("getClientIp: prefiere x-forwarded-for (primer valor)", () => {
  const req = new Request("https://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
  assertEquals(getClientIp(req), "1.2.3.4");
});

Deno.test("getClientIp: fallback cf-connecting-ip", () => {
  const req = new Request("https://x", { headers: { "cf-connecting-ip": "9.9.9.9" } });
  assertEquals(getClientIp(req), "9.9.9.9");
});

Deno.test("getClientIp: 'unknown' si no hay headers", () => {
  assertEquals(getClientIp(new Request("https://x")), "unknown");
});
