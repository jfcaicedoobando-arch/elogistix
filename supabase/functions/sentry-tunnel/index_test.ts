/**
 * Smoke test para sentry-tunnel — valida parser de envelope sin red.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseEnvelopeDsn } from "./index.ts";

Deno.test("parseEnvelopeDsn extrae host y projectId de un DSN válido", () => {
  const dsn = "https://abc123@o4511415732404224.ingest.us.sentry.io/4509";
  const header = JSON.stringify({ dsn, sent_at: "2026-06-12T00:00:00Z" });
  const parsed = parseEnvelopeDsn(header);
  assertEquals(parsed?.host, "o4511415732404224.ingest.us.sentry.io");
  assertEquals(parsed?.projectId, "4509");
});

Deno.test("parseEnvelopeDsn devuelve null si la primera línea no es JSON", () => {
  assertEquals(parseEnvelopeDsn("no-es-json"), null);
});

Deno.test("parseEnvelopeDsn devuelve null si falta el dsn", () => {
  assertEquals(parseEnvelopeDsn(JSON.stringify({ sent_at: "x" })), null);
});

Deno.test("parseEnvelopeDsn devuelve null si el dsn es malformado", () => {
  assertEquals(parseEnvelopeDsn(JSON.stringify({ dsn: "not-a-url" })), null);
});

Deno.test("parseEnvelopeDsn devuelve null si el path no tiene projectId", () => {
  assertEquals(
    parseEnvelopeDsn(JSON.stringify({ dsn: "https://k@host.com/" })),
    null,
  );
});
