/**
 * Ronda YAGNI · defecto 10 — el rebote actualiza el envío original
 * (correlación por `message_id`), no crea una fila nueva por `event_id`.
 *
 * Run: deno test --no-check --allow-read supabase/functions/handle-email-events/index_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("defecto 10: correlaciona por message_id del proveedor", () => {
  assertStringIncludes(src, "email_send_log_touch");
  assertStringIncludes(src, "providerMessageId || eventId");
  assertStringIncludes(src, "event.data.message_id");
  assert(
    !src.includes("message_id: eventId"),
    "sigue insertando una fila nueva usando el event_id como message_id",
  );
});
