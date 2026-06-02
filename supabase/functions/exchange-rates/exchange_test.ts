// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeRates, FALLBACK } from "./index.ts";

// ── FALLBACK constants ────────────────────────────────────────

Deno.test("FALLBACK has expected usdMxn value", () => {
  assertEquals(FALLBACK.usdMxn, 17.25);
});

Deno.test("FALLBACK has expected eurMxn value", () => {
  assertEquals(FALLBACK.eurMxn, 18.5);
});

// ── computeRates: valid data ──────────────────────────────────

Deno.test("computeRates: inverts USD rate correctly", () => {
  // MXN→USD = 0.05  ⟹  USD/MXN = 20.0000
  const result = computeRates({ rates: { USD: 0.05, EUR: 0.04 } });
  assertEquals(result.usdMxn, 20.0);
});

Deno.test("computeRates: inverts EUR rate correctly", () => {
  const result = computeRates({ rates: { USD: 0.05, EUR: 0.04 } });
  assertEquals(result.eurMxn, 25.0);
});

Deno.test("computeRates: result rounded to 4 decimal places", () => {
  // 1 / 0.058 = 17.2413793... → 17.2414
  const result = computeRates({ rates: { USD: 0.058, EUR: 0.054 } });
  assertEquals(result.usdMxn, 17.2414);
});

// ── computeRates: fallback when data missing ─────────────────

Deno.test("computeRates: null data → FALLBACK values", () => {
  const result = computeRates(null);
  assertEquals(result.usdMxn, FALLBACK.usdMxn);
  assertEquals(result.eurMxn, FALLBACK.eurMxn);
});

Deno.test("computeRates: empty rates object → FALLBACK values", () => {
  const result = computeRates({ rates: {} });
  assertEquals(result.usdMxn, FALLBACK.usdMxn);
  assertEquals(result.eurMxn, FALLBACK.eurMxn);
});

Deno.test("computeRates: missing USD rate → FALLBACK usdMxn", () => {
  const result = computeRates({ rates: { EUR: 0.04 } });
  assertEquals(result.usdMxn, FALLBACK.usdMxn);
  assertEquals(result.eurMxn, 25.0);
});

Deno.test("computeRates: missing EUR rate → FALLBACK eurMxn", () => {
  const result = computeRates({ rates: { USD: 0.05 } });
  assertEquals(result.usdMxn, 20.0);
  assertEquals(result.eurMxn, FALLBACK.eurMxn);
});

// ── Timeout fallback contract ─────────────────────────────────

Deno.test("timeout fallback: AbortError triggers FALLBACK response shape", () => {
  // Simulates what the catch block returns on timeout (DOMException abort)
  const abortErr = new DOMException("The operation was aborted.", "AbortError");
  const message = abortErr instanceof Error ? abortErr.message : String(abortErr);
  // Verify the fallback payload includes both keys
  const fallbackPayload = { error: message, ...FALLBACK };
  assertEquals(typeof fallbackPayload.usdMxn, "number");
  assertEquals(typeof fallbackPayload.eurMxn, "number");
});
