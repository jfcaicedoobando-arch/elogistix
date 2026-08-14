/**
 * Ola 13 · R4EF-06 — Cobertura del acuse: AbortSignal de 12 s (R3EF-02) y
 * clasificación error_timeout / error_network.
 * Run: deno test --no-check supabase/functions/facturapi-reconciliar-cancelaciones/reconcile_acuse_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { descargarAcuse } from "./reconcile.ts";

Deno.test("R4EF-06/acuse: el fetch recibe un AbortSignal (timeout 12 s)", async () => {
  let signalVisto: unknown = null;
  const fakeFetch = ((_url: string, init?: RequestInit) => {
    signalVisto = init?.signal ?? null;
    return Promise.resolve(new Response("<xml/>", { status: 200 }));
  }) as typeof fetch;
  const r = await descargarAcuse("fapi-1", "key", fakeFetch);
  assertEquals(r.status, "accepted");
  assert(signalVisto instanceof AbortSignal, "fetch debe recibir signal (R3EF-02)");
  assert(!(signalVisto as AbortSignal).aborted, "no debe venir abortado de fábrica");
});

Deno.test("R4EF-06/acuse: DOMException TimeoutError => error_timeout (reintentable)", async () => {
  const fakeFetch = (() =>
    Promise.reject(new DOMException("The operation timed out.", "TimeoutError"))) as unknown as typeof fetch;
  const r = await descargarAcuse("fapi-1", "key", fakeFetch);
  assertEquals(r.status, "error_timeout");
  assertEquals(r.xml, null);
});

Deno.test("R4EF-06/acuse: DOMException AbortError => error_timeout", async () => {
  const fakeFetch = (() =>
    Promise.reject(new DOMException("The operation was aborted.", "AbortError"))) as unknown as typeof fetch;
  const r = await descargarAcuse("fapi-1", "key", fakeFetch);
  assertEquals(r.status, "error_timeout");
});

Deno.test("R4EF-06/acuse: TypeError de red => error_network (no se confunde con timeout)", async () => {
  const fakeFetch = (() =>
    Promise.reject(new TypeError("error sending request"))) as unknown as typeof fetch;
  const r = await descargarAcuse("fapi-1", "key", fakeFetch);
  assertEquals(r.status, "error_network");
});

Deno.test("R4EF-06/acuse: 425 (acuse aún no generado) => pending", async () => {
  const fakeFetch = ((_url: string) => Promise.resolve(new Response("", { status: 425 }))) as typeof fetch;
  const r = await descargarAcuse("fapi-1", "key", fakeFetch);
  assertEquals(r.status, "pending");
  assertEquals(r.xml, null);
});

Deno.test("R4EF-06/acuse: 5xx del proveedor => error_<status>", async () => {
  const fakeFetch = ((_url: string) => Promise.resolve(new Response("boom", { status: 500 }))) as typeof fetch;
  const r = await descargarAcuse("fapi-1", "key", fakeFetch);
  assertEquals(r.status, "error_500");
});
