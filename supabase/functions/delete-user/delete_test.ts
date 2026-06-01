// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseDeleteBody, assertCanDelete } from "./index.ts";

Deno.test("parseDeleteBody: null → null", () => {
  assertEquals(parseDeleteBody(null), null);
});

Deno.test("parseDeleteBody: objeto vacío → null", () => {
  assertEquals(parseDeleteBody({}), null);
});

Deno.test("parseDeleteBody: user_id vacío → null", () => {
  assertEquals(parseDeleteBody({ user_id: "" }), null);
});

Deno.test("parseDeleteBody: user_id no string → null", () => {
  assertEquals(parseDeleteBody({ user_id: 123 }), null);
});

Deno.test("parseDeleteBody: user_id válido → objeto", () => {
  assertEquals(parseDeleteBody({ user_id: "uuid-abc" }), { user_id: "uuid-abc" });
});

Deno.test("assertCanDelete: target vacío → error", () => {
  assertEquals(assertCanDelete("uid-1", ""), "user_id es requerido");
});

Deno.test("assertCanDelete: self-delete → error", () => {
  assertEquals(assertCanDelete("uid-1", "uid-1"), "No puedes eliminar tu propia cuenta");
});

Deno.test("assertCanDelete: target distinto → null", () => {
  assertEquals(assertCanDelete("uid-1", "uid-2"), null);
});
