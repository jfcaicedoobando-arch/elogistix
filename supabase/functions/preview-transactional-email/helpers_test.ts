// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isAuthorized, resolveSubject } from "./helpers.ts";

Deno.test("isAuthorized: header correcto → true", () => {
  assertEquals(isAuthorized("Bearer secret-123", "secret-123"), true);
});

Deno.test("isAuthorized: case-insensitive Bearer", () => {
  assertEquals(isAuthorized("bearer secret-123", "secret-123"), true);
});

Deno.test("isAuthorized: token distinto → false", () => {
  assertEquals(isAuthorized("Bearer wrong", "secret-123"), false);
});

Deno.test("isAuthorized: header nulo → false", () => {
  assertEquals(isAuthorized(null, "secret-123"), false);
});

Deno.test("isAuthorized: apiKey vacío → false aunque coincida", () => {
  assertEquals(isAuthorized("Bearer ", ""), false);
  assertEquals(isAuthorized(null, ""), false);
});

Deno.test("resolveSubject: string literal", () => {
  assertEquals(resolveSubject("Hola", { x: 1 }), "Hola");
});

Deno.test("resolveSubject: función recibe previewData", () => {
  const fn = (d: Record<string, unknown>) => `Folio ${d.folio}`;
  assertEquals(resolveSubject(fn, { folio: "LC-001" }), "Folio LC-001");
});
