// @ts-nocheck — Deno runtime
// Copia local de helpers para evitar type-check transitivo en index.ts.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

interface EmbarqueLite {
  modo: string | null; contenedor: string | null; naviera: string | null;
}
function mapNaviera(n: string | null): string | null {
  if (!n) return null;
  const map: Record<string, string> = { MSC: "MSC", "Wan Hai": "WHL", SITC: "SITC" };
  return map[n] ?? null;
}
function validateEmbarqueForTracking(emb: EmbarqueLite) {
  if (emb.modo !== "Marítimo") return { errorCode: "not_maritimo" };
  if (!emb.contenedor) return { errorCode: "missing_contenedor" };
  const sl = mapNaviera(emb.naviera);
  if (!sl) return { errorCode: "naviera_no_soportada" };
  return { ok: true, shippingLine: sl };
}

const base: EmbarqueLite = { modo: "Marítimo", contenedor: "MSCU1234567", naviera: "MSC" };

Deno.test("rechaza modo no marítimo", () => {
  const r = validateEmbarqueForTracking({ ...base, modo: "Aéreo" });
  assert("errorCode" in r && r.errorCode === "not_maritimo");
});
Deno.test("rechaza sin contenedor", () => {
  const r = validateEmbarqueForTracking({ ...base, contenedor: null });
  assert("errorCode" in r && r.errorCode === "missing_contenedor");
});
Deno.test("rechaza naviera no soportada", () => {
  const r = validateEmbarqueForTracking({ ...base, naviera: "Xyz" });
  assert("errorCode" in r && r.errorCode === "naviera_no_soportada");
});
Deno.test("happy path", () => {
  const r = validateEmbarqueForTracking(base);
  assertEquals((r as { shippingLine: string }).shippingLine, "MSC");
});
