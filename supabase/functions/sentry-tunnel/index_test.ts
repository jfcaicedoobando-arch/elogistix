/**
 * Tests del sentry-tunnel: validación del header DSN y rate-limit en memoria.
 * 13.114.17: añade cobertura del rate-limit (60 req/min/IP).
 */
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { parseEnvelopeDsn, checkRateLimit } from "./index.ts";

Deno.test("parseEnvelopeDsn extrae host y projectId del header", () => {
  const header = JSON.stringify({
    dsn: "https://abc@o123.ingest.us.sentry.io/456",
    sent_at: "2026-06-23T00:00:00Z",
  });
  const got = parseEnvelopeDsn(header);
  assertEquals(got, { host: "o123.ingest.us.sentry.io", projectId: "456" });
});

Deno.test("parseEnvelopeDsn retorna null si el header no tiene DSN", () => {
  assertEquals(parseEnvelopeDsn(JSON.stringify({ sent_at: "x" })), null);
});

Deno.test("parseEnvelopeDsn retorna null si el JSON es inválido", () => {
  assertEquals(parseEnvelopeDsn("not-json"), null);
});

Deno.test("checkRateLimit permite hasta 60 requests por IP", () => {
  const ip = `test-ip-${crypto.randomUUID()}`;
  const t0 = Date.now();
  for (let i = 0; i < 60; i++) {
    assertEquals(checkRateLimit(ip, t0 + i), true, `req ${i} debería pasar`);
  }
  assertEquals(checkRateLimit(ip, t0 + 60), false, "req 61 debería bloquearse");
});

Deno.test("checkRateLimit libera la ventana después de 60s", () => {
  const ip = `test-ip-${crypto.randomUUID()}`;
  const t0 = Date.now();
  for (let i = 0; i < 60; i++) checkRateLimit(ip, t0 + i);
  assertEquals(checkRateLimit(ip, t0 + 60), false);
  // Ventana expirada → nuevo bucket.
  assertEquals(checkRateLimit(ip, t0 + 60_001), true);
});
