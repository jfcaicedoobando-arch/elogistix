/**
 * R3 · P2 — cxc-recordatorio-enviar: el recordatorio se registra DESPUÉS de
 * enviar (antes quedaba constancia falsa de "enviado" cuando el envío
 * fallaba) y el message_id es estable por (factura, canal, ventana) para
 * deduplicar dobles clics (antes `Date.now()` → correos duplicados).
 *
 * Run: deno test --no-check --allow-read supabase/functions/cxc-recordatorio-enviar/index_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("P2: el insert en factura_recordatorios ocurre DESPUÉS del envío", () => {
  const idxSend = src.indexOf("await sendRecordatorio(");
  const idxInsert = src.indexOf(".from('factura_recordatorios').insert(");
  assert(idxSend > 0 && idxInsert > idxSend, "el registro debe ir tras el envío exitoso");
});

Deno.test("P2: message_id estable por ventana (sin Date.now() crudo)", () => {
  assertStringIncludes(src, "messageIdRecordatorio(factura.id, canal)");
  assert(!src.includes("recordatorio-${templateData.numero}-${Date.now()}"), "quedó idempotency por Date.now()");
});

Deno.test("P2: fallo de registro tras envío exitoso no devuelve 500 (evita reintento/duplicado)", () => {
  const idx = src.indexOf("if (insertError)");
  assert(idx > 0);
  const bloque = src.slice(idx, idx + 400);
  assertStringIncludes(bloque, "console.error");
  assert(!bloque.includes("throw"), "no debe lanzar tras un envío exitoso");
});
