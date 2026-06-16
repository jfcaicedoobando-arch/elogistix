// @ts-nocheck
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isEmail } from "./handlers.ts";

Deno.test("isEmail: válidos", () => {
  assert(isEmail("a@b.com"));
  assert(isEmail("user.name+tag@sub.dominio.mx"));
});

Deno.test("isEmail: inválidos", () => {
  assertEquals(isEmail(""), false);
  assertEquals(isEmail("noarroba"), false);
  assertEquals(isEmail("a@"), false);
  assertEquals(isEmail("@b.com"), false);
  assertEquals(isEmail("a b@c.com"), false);
});
