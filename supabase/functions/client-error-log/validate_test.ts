// @ts-nocheck — Deno runtime
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkRateLimit, getClientIp, truncate } from "./index.ts";

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

Deno.test("checkRateLimit: permite 20, bloquea la 21 dentro de la ventana", () => {
  const ip = `test-${crypto.randomUUID()}`;
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) {
    const r = checkRateLimit(ip, t0 + i);
    assertEquals(r.ok, true);
  }
  const blocked = checkRateLimit(ip, t0 + 21);
  assertEquals(blocked.ok, false);
  assertEquals(blocked.retryAfter >= 1, true);
});

Deno.test("checkRateLimit: ventana nueva resetea contador", () => {
  const ip = `test-${crypto.randomUUID()}`;
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) checkRateLimit(ip, t0 + i);
  // Más de 60s después
  const r = checkRateLimit(ip, t0 + 61_000);
  assertEquals(r.ok, true);
});
