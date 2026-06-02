// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyTrackingResult } from "./index.ts";

// ── Token / auth guard ────────────────────────────────────────

Deno.test("classifyTrackingResult: null token → 400 missing token", () => {
  const out = classifyTrackingResult(null, null);
  assertEquals(out.ok, false);
  assertEquals(out.status, 400);
  assertEquals(out.error, "Token requerido");
});

Deno.test("classifyTrackingResult: empty string token → 400", () => {
  // Empty string is falsy
  const out = classifyTrackingResult("", null);
  assertEquals(out.ok, false);
  assertEquals(out.status, 400);
});

// ── Schema validation: not_found ─────────────────────────────

Deno.test("classifyTrackingResult: null result → 404 not found", () => {
  const out = classifyTrackingResult("tok123", null);
  assertEquals(out.ok, false);
  assertEquals(out.status, 404);
  assertEquals(out.error, "Enlace de tracking no encontrado");
});

Deno.test("classifyTrackingResult: result.error=not_found → 404", () => {
  const out = classifyTrackingResult("tok123", { error: "not_found" });
  assertEquals(out.ok, false);
  assertEquals(out.status, 404);
});

// ── Schema validation: expired ────────────────────────────────

Deno.test("classifyTrackingResult: result.error=expired → 410 gone", () => {
  const out = classifyTrackingResult("tok123", { error: "expired" });
  assertEquals(out.ok, false);
  assertEquals(out.status, 410);
  assertEquals(out.error, "Este enlace de tracking ha expirado");
});

// ── Schema validation: valid payload ─────────────────────────

Deno.test("classifyTrackingResult: valid result → ok:true with fields", () => {
  const out = classifyTrackingResult("tok123", {
    embarque: { id: "emb-1" },
    eventos: [{ tipo: "salida" }],
    organizacion: { nombre: "Org A" },
  });
  assertEquals(out.ok, true);
  if (out.ok) {
    assertEquals((out.embarque as { id: string }).id, "emb-1");
    assertEquals(Array.isArray(out.eventos), true);
    assertEquals((out.organizacion as { nombre: string }).nombre, "Org A");
  }
});

Deno.test("classifyTrackingResult: missing eventos → defaults to []", () => {
  const out = classifyTrackingResult("tok123", { embarque: { id: "x" } });
  assertEquals(out.ok, true);
  if (out.ok) assertEquals(out.eventos, []);
});

Deno.test("classifyTrackingResult: missing organizacion → defaults to null", () => {
  const out = classifyTrackingResult("tok123", { embarque: { id: "x" } });
  assertEquals(out.ok, true);
  if (out.ok) assertEquals(out.organizacion, null);
});
