/**
 * Ola P2 — Pruebas de la lectura acotada del body del webhook (endpoint público)
 * y del HMAC calculado sobre los bytes exactos aceptados.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeSignature,
  computeSignatureBytes,
  leerCuerpoAcotado,
  MAX_WEBHOOK_BYTES,
} from "./helpers.ts";

function reqConBody(body: BodyInit | null, headers: Record<string, string> = {}): Request {
  return new Request("https://x.test/webhook", { method: "POST", body, headers });
}

Deno.test("MAX_WEBHOOK_BYTES es 256 KiB", () => {
  assertEquals(MAX_WEBHOOK_BYTES, 262144);
});

Deno.test("acepta un payload normal y devuelve bytes y texto coherentes", async () => {
  const json = JSON.stringify({ type: "invoice.status_updated", id: "evt_1" });
  const r = await leerCuerpoAcotado(reqConBody(json));
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.raw, json);
  assertEquals(r.bytes.byteLength, new TextEncoder().encode(json).byteLength);
});

Deno.test("rechaza por Content-Length declarado mayor al tope (sin leer el body)", async () => {
  const r = await leerCuerpoAcotado(
    reqConBody("x", { "content-length": String(MAX_WEBHOOK_BYTES + 1) }),
    MAX_WEBHOOK_BYTES,
  );
  assertEquals(r, { ok: false, motivo: "too_large" });
});

Deno.test("rechaza por bytes reales aunque no haya Content-Length (stream chunked)", async () => {
  // Stream que emitiría 1 MiB en trozos: el corte debe ocurrir antes de acumularlo.
  let emitidos = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (emitidos >= 16) {
        controller.close();
        return;
      }
      emitidos++;
      controller.enqueue(new Uint8Array(64 * 1024).fill(65));
    },
  });
  const init: RequestInit & { duplex?: "half" } = {
    method: "POST",
    body: stream,
    duplex: "half",
  };
  const req = new Request("https://x.test/webhook", init);
  const r = await leerCuerpoAcotado(req, MAX_WEBHOOK_BYTES);
  assertEquals(r, { ok: false, motivo: "too_large" });
  // No se consumió todo el stream: se abortó apenas se pasó el tope.
  assert(emitidos <= 5, `se leyeron demasiados trozos: ${emitidos}`);
});

Deno.test("acepta exactamente el tope y rechaza un byte más", async () => {
  const tope = 1024;
  const justo = "a".repeat(tope);
  const ok = await leerCuerpoAcotado(reqConBody(justo), tope);
  assert(ok.ok);
  const pasado = await leerCuerpoAcotado(reqConBody("a".repeat(tope + 1)), tope);
  assertEquals(pasado, { ok: false, motivo: "too_large" });
});

Deno.test("body vacío devuelve cero bytes sin error", async () => {
  const r = await leerCuerpoAcotado(new Request("https://x.test/webhook", { method: "POST" }));
  assert(r.ok);
  if (r.ok) assertEquals(r.bytes.byteLength, 0);
});

Deno.test("HMAC sobre bytes coincide con el HMAC sobre el texto equivalente", async () => {
  const json = JSON.stringify({ type: "invoice.status_updated", nota: "acentós ñ" });
  const bytes = new TextEncoder().encode(json);
  assertEquals(await computeSignatureBytes(bytes, "s3cr3t"), await computeSignature(json, "s3cr3t"));
});

Deno.test("HMAC de los bytes leídos coincide con el esperado del payload firmado", async () => {
  const json = JSON.stringify({ type: "receipt.status_updated" });
  const r = await leerCuerpoAcotado(reqConBody(json));
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(await computeSignatureBytes(r.bytes, "k"), await computeSignature(json, "k"));
});
