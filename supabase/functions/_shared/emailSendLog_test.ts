/**
 * R3 · P2 — Guarda estructural: estados de email_send_log vía upsert (RPC
 * `email_send_log_touch`), nunca con un segundo INSERT sobre el mismo
 * message_id (revienta uq_email_send_log_message_id con 23505 silencioso y
 * deja filas zombie en 'pending').
 *
 * v13.823.2: el pipeline de cola propio (`send-transactional-email` +
 * `process-email-queue`) se retiró al migrar a la entrega administrada de
 * Lovable (v13.818.0). La guarda ahora apunta al adaptador vigente.
 *
 * Run: deno test --no-check --allow-read supabase/functions/_shared/emailSendLog_test.ts
 */
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

async function leer(archivo: string): Promise<string> {
  return await Deno.readTextFile(new URL(archivo, import.meta.url));
}

// Pipeline de estados post-pending: todos deben pasar por la RPC de upsert.
const PIPELINE = [
  "./enviarEmailPlantilla.ts",
  "./emailSendLog.ts",
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

Deno.test("P2 email_send_log: la helper delega SIEMPRE en la RPC de upsert", async () => {
  const src = await leer("./emailSendLog.ts");
  assertStringIncludes(src, 'supabase.rpc("email_send_log_touch"');
  const codigo = src.slice(src.indexOf("export async function"));
  assert(!codigo.includes(".insert("), "la helper no debe insertar directo en email_send_log");
});

Deno.test("P2 email_send_log: el adaptador registra 'sent', 'suppressed' y 'failed'", async () => {
  const src = await leer("./enviarEmailPlantilla.ts");
  for (const estado of ['status: "sent"', 'status: "suppressed"', 'status: "failed"']) {
    assertStringIncludes(src, estado);
  }
});
