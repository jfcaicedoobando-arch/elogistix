// @ts-nocheck — Deno runtime
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { truncate, tryExtractUserId } from "./index.ts";

Deno.test("truncate: null/undefined → null", () => {
  assertEquals(truncate(null, 10), null);
  assertEquals(truncate(undefined, 10), null);
});

Deno.test("truncate: string corta → idéntica", () => {
  assertEquals(truncate("hola", 10), "hola");
});

Deno.test("truncate: string larga → cortada", () => {
  assertEquals(truncate("abcdefghij", 4), "abcd");
});

Deno.test("truncate: objeto se serializa", () => {
  assertEquals(truncate({ a: 1 }, 100), '{"a":1}');
});

Deno.test("tryExtractUserId: sin header → null", () => {
  assertEquals(tryExtractUserId(new Request("https://x/y")), null);
});

Deno.test("tryExtractUserId: header no Bearer → null", () => {
  const req = new Request("https://x/y", { headers: { Authorization: "Basic abc" } });
  assertEquals(tryExtractUserId(req), null);
});

Deno.test("tryExtractUserId: JWT con sub → lo extrae", () => {
  const payload = btoa(JSON.stringify({ sub: "user-123" }));
  const fake = `header.${payload}.signature`;
  const req = new Request("https://x/y", { headers: { Authorization: `Bearer ${fake}` } });
  assertEquals(tryExtractUserId(req), "user-123");
});

Deno.test("tryExtractUserId: JWT sin sub → null", () => {
  const payload = btoa(JSON.stringify({ other: "x" }));
  const fake = `h.${payload}.s`;
  const req = new Request("https://x/y", { headers: { Authorization: `Bearer ${fake}` } });
  assertEquals(tryExtractUserId(req), null);
});
