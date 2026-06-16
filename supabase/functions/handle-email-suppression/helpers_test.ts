// @ts-nocheck
import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseSuppressionPayload,
  mapReasonToStatus,
  mapReasonToMessage,
  redactEmail,
} from "./helpers.ts";

// ── parseSuppressionPayload ────────────────────────────────────

Deno.test("parseSuppressionPayload: payload válido", () => {
  const out = parseSuppressionPayload(JSON.stringify({
    data: { email: "a@b.com", reason: "bounce", is_retry: false, retry_count: 0 },
  }));
  assertEquals(out.email, "a@b.com");
  assertEquals(out.reason, "bounce");
});

Deno.test("parseSuppressionPayload: sin `data` → throw", () => {
  assertThrows(
    () => parseSuppressionPayload(JSON.stringify({ foo: 1 })),
    Error,
    "Missing data field",
  );
});

Deno.test("parseSuppressionPayload: sin email → throw", () => {
  assertThrows(
    () => parseSuppressionPayload(JSON.stringify({ data: { reason: "bounce" } })),
    Error,
    "Missing required fields",
  );
});

Deno.test("parseSuppressionPayload: sin reason → throw", () => {
  assertThrows(
    () => parseSuppressionPayload(JSON.stringify({ data: { email: "a@b.com" } })),
    Error,
    "Missing required fields",
  );
});

Deno.test("parseSuppressionPayload: JSON inválido → throw", () => {
  assertThrows(() => parseSuppressionPayload("not-json"));
});

// ── mapReasonToStatus ──────────────────────────────────────────

Deno.test("mapReasonToStatus: mapeo conocido", () => {
  assertEquals(mapReasonToStatus("bounce"), "bounced");
  assertEquals(mapReasonToStatus("complaint"), "complained");
  assertEquals(mapReasonToStatus("unsubscribe"), "suppressed");
});

Deno.test("mapReasonToStatus: desconocido → suppressed", () => {
  assertEquals(mapReasonToStatus("otro"), "suppressed");
  assertEquals(mapReasonToStatus(""), "suppressed");
});

// ── mapReasonToMessage ─────────────────────────────────────────

Deno.test("mapReasonToMessage: cada razón devuelve mensaje específico", () => {
  assertEquals(
    mapReasonToMessage("bounce"),
    "Permanent bounce — email address is invalid or rejected",
  );
  assertEquals(
    mapReasonToMessage("complaint"),
    "Spam complaint — recipient marked email as spam",
  );
  assertEquals(mapReasonToMessage("unsubscribe"), "Recipient unsubscribed");
  assertEquals(mapReasonToMessage("???"), "Email suppressed");
});

// ── redactEmail ────────────────────────────────────────────────

Deno.test("redactEmail: oculta usuario pero deja dominio", () => {
  assertEquals(redactEmail("juan@example.com"), "j***@example.com");
});

Deno.test("redactEmail: email inválido → ***", () => {
  assertEquals(redactEmail("noarroba"), "***");
  assertEquals(redactEmail(""), "***");
});
