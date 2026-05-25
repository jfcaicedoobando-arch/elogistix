// @ts-nocheck — Deno runtime
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseBody } from "./index.ts";

Deno.test("parseBody: null → null", () => {
  assertEquals(parseBody(null), null);
});

Deno.test("parseBody: faltan campos → null", () => {
  assertEquals(parseBody({ email: "a@b.com" }), null);
});

Deno.test("parseBody: campos no-string → null", () => {
  assertEquals(parseBody({ email: 1, cliente_id: "c", organization_id: "o" }), null);
});

Deno.test("parseBody: payload válido", () => {
  const r = parseBody({ email: "a@b.com", cliente_id: "c1", organization_id: "o1" });
  assert(r);
  assertEquals(r!.email, "a@b.com");
  assertEquals(r!.cliente_id, "c1");
  assertEquals(r!.organization_id, "o1");
});
