// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseBody } from "./index.ts";

// ── parseBody: auth guard (missing / invalid fields) ─────────

Deno.test("parseBody: null → null", () => {
  assertEquals(parseBody(null), null);
});

Deno.test("parseBody: empty object → null", () => {
  assertEquals(parseBody({}), null);
});

Deno.test("parseBody: cliente_id missing → null", () => {
  assertEquals(parseBody({ other: "field" }), null);
});

Deno.test("parseBody: cliente_id empty string → null", () => {
  assertEquals(parseBody({ cliente_id: "" }), null);
});

Deno.test("parseBody: cliente_id non-string → null", () => {
  assertEquals(parseBody({ cliente_id: 42 }), null);
});

Deno.test("parseBody: cliente_id boolean → null", () => {
  assertEquals(parseBody({ cliente_id: true }), null);
});

// ── parseBody: response shape ─────────────────────────────────

Deno.test("parseBody: valid cliente_id → parsed body", () => {
  assertEquals(
    parseBody({ cliente_id: "cli-uuid-123" }),
    { cliente_id: "cli-uuid-123" },
  );
});

Deno.test("parseBody: extra fields ignored, cliente_id returned", () => {
  const result = parseBody({ cliente_id: "cli-abc", extra: "ignored" });
  assertEquals(result, { cliente_id: "cli-abc" });
});

Deno.test("parseBody: non-object primitive → null", () => {
  assertEquals(parseBody("just-a-string"), null);
  assertEquals(parseBody(123), null);
  assertEquals(parseBody(true), null);
});
