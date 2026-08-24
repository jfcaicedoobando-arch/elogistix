/**
 * R3 · P2 — Guarda estructural: estados de email_send_log vía upsert (RPC
 * `email_send_log_touch`), nunca con un segundo INSERT sobre el mismo
 * message_id (revienta uq_email_send_log_message_id con 23505 silencioso y
 * deja filas zombie en 'pending').
 *
 * Run: deno test --no-check --allow-read supabase/functions/_shared/emailSendLog_test.ts
 */
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

async function leer(archivo: string): Promise<string> {
  return await Deno.readTextFile(new URL(archivo, import.meta.url));
}

// Pipeline de estados post-pending: todos deben pasar por la RPC de upsert.
const PIPELINE = [
  "../send-transactional-email/index.ts",
  "../process-email-queue/processItem.ts",
  "../process-email-queue/queueAuth.ts",
  "../process-email-queue/messageProcessor.ts",
];

for (const archivo of PIPELINE) {
  Deno.test(`P2 email_send_log: ${archivo} usa registrarEstadoEmail (upsert) para estados`, async () => {
    const src = await leer(archivo);
    assertStringIncludes(src, "registrarEstadoEmail");
    assert(
      !src.includes(".from('email_send_log').insert({") &&
        !src.includes('.from("email_send_log").insert({'),
      `${archivo} conserva un INSERT directo a email_send_log (23505 silencioso)`,
    );
  });
}

/** Busca la migración que contiene un marcador (el nombre de archivo lo asigna la plataforma). */
async function leerMigracionCon(marcador: string): Promise<string> {
  const dir = new URL("../../migrations/", import.meta.url);
  for await (const entrada of Deno.readDir(dir)) {
    if (!entrada.isFile || !entrada.name.endsWith(".sql")) continue;
    const src = await Deno.readTextFile(new URL(entrada.name, dir));
    if (src.includes(marcador)) return src;
  }
  throw new Error(`ninguna migración contiene ${marcador}`);
}

Deno.test("P2 email_send_log: existe migración con RPC email_send_log_touch y limpieza de zombies", async () => {
  const src = await leerMigracionCon("CREATE OR REPLACE FUNCTION public.email_send_log_touch");
  assertStringIncludes(src, "email_send_log_touch");
  assertStringIncludes(src, "ON CONFLICT (message_id) DO UPDATE");
  assertStringIncludes(src, "intentos");
  // Limpieza de las pending viejas (>24 h) → failed.
  assertStringIncludes(src, "WHERE status = 'pending'");
  assertStringIncludes(src, "TO service_role");
});

Deno.test("P2 email_send_log: la cola cuenta reintentos con la columna intentos", async () => {
  const src = await leer("../process-email-queue/queueProcessor.ts");
  assertStringIncludes(src, "intentos");
});

Deno.test("P2 email_send_log: send-transactional-email registra 'failed' tras error de enqueue", async () => {
  const src = await leer("../send-transactional-email/index.ts");
  const idxEnqueue = src.indexOf("if (enqueueError)");
  assert(idxEnqueue > 0);
  const bloque = src.slice(idxEnqueue, idxEnqueue + 900);
  assertStringIncludes(bloque, "registrarEstadoEmail");
  assertStringIncludes(bloque, "status: 'failed'");
});
