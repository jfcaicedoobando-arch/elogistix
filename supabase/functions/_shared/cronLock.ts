/**
 * R3 · P3 — Mutex anti-traslape para crons de edge functions.
 *
 * pg_cron puede disparar dos ejecuciones traslapadas del mismo job. El lock
 * es un lease con TTL en la tabla `cron_locks` (migración
 * 20260831000200_r3_cron_locks.sql), no un advisory lock: un advisory xact
 * muere al terminar el RPC y uno de sesión puede quedar retenido por otra
 * conexión del pool de PostgREST. El TTL garantiza que el lock se libera
 * solo aunque la edge muera a la mitad.
 *
 * Uso:
 *   const lock = await tomarCronLock(admin, "rep-retry-nocturno", 3600);
 *   if (lock === "ocupado") return jsonResponse({ ok: true, skipped: "locked" });
 *   try { ...trabajo... } finally { if (lock === "tomado") await soltarCronLock(admin, "rep-retry-nocturno"); }
 *
 * Si la RPC falla (p. ej. migración no aplicada aún) se devuelve "error" y el
 * caller decide; la recomendación es CONTINUAR (fail-open) capturando a
 * Sentry: perder el mutex temporalmente es mejor que apagar el cron.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { captureEdgeException } from "./sentry.ts";

export type ResultadoCronLock = "tomado" | "ocupado" | "error";

export async function tomarCronLock(
  admin: SupabaseClient,
  key: string,
  ttlSeconds = 3600,
): Promise<ResultadoCronLock> {
  const { data, error } = await admin.rpc("cron_try_lock", {
    p_key: key,
    p_ttl_seconds: ttlSeconds,
    p_owner: "edge",
  });
  if (error) {
    await captureEdgeException(new Error(`cron_try_lock failed: ${error.message}`), {
      fn: key,
    });
    return "error";
  }
  return data === true ? "tomado" : "ocupado";
}

export async function soltarCronLock(admin: SupabaseClient, key: string): Promise<void> {
  const { error } = await admin.rpc("cron_unlock", { p_key: key });
  if (error) {
    // Best-effort: el TTL del lease lo libera aunque esto falle.
    console.error(JSON.stringify({ level: "warn", fn: key, msg: "cron_unlock failed", error: error.message }));
  }
}
