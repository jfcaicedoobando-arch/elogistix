/**
 * Captura snapshots diarios de auditoría para todas las organizaciones activas.
 * Idempotente: la tabla `auditoria_snapshots` tiene UNIQUE(organization_id, fecha).
 *
 * Auth: requiere header X-Cron-Secret == CRON_SECRET (cron-only).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { initSentryEdge, captureEdgeException } from "../_shared/sentry.ts";
import { timingSafeEqual } from "../_shared/timingSafe.ts";

initSentryEdge("auditoria-snapshot-daily");

/** Returns true when the provided secret matches the header value.
 *  R3 · P3: comparación constante en tiempo (patrón _shared/timingSafe.ts). */
export function checkCronSecret(
  secret: string | undefined,
  headerValue: string | null,
): boolean {
  return !!secret && headerValue != null && timingSafeEqual(headerValue, secret);
}

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const corsHeaders = buildCors(req);

  const log = createLogger(req, "auditoria-snapshot-daily");

  const cronSecret = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("X-Cron-Secret");
  if (!checkCronSecret(cronSecret, headerSecret)) {
    log.finish(401, "unauthorized_cron");
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: orgs, error: orgsErr } = await admin
      .from("organizations")
      .select("id, nombre")
      .eq("activo", true);
    if (orgsErr) throw orgsErr;

    const resultados: Array<{ org: string; ok: boolean; error?: string }> = [];
    for (const org of orgs ?? []) {
      const { error } = await admin.rpc("auditoria_capturar_snapshot", {
        p_organization_id: org.id,
      });
      if (error) {
        // M-4: registra el fallo por-org en Sentry con organization_id.
        // Antes solo el catch global enviaba a Sentry, así que un fallo en
        // una org individual quedaba invisible en monitoreo.
        console.error(`[auditoria-snapshot-daily] org=${org.id} failed:`, error);
        await captureEdgeException(error, {
          fn: "auditoria-snapshot-daily",
          status_code: 500,
          organization_id: org.id,
          extra: { organization_nombre: org.nombre },
        });
      }
      resultados.push({
        org: org.nombre,
        ok: !error,
        error: error?.message,
      });
    }

    const fallos = resultados.filter((r) => !r.ok).length;
    // Ronda YAGNI · defecto 10: si alguna org falló, el cron debe recibir 500
    // (antes siempre 200 y el fallo quedaba invisible). El snapshot es
    // idempotente por UNIQUE(organization_id, fecha), así que reintentar es
    // seguro y no duplica filas.
    const status = fallos > 0 ? 500 : 200;
    log.finish(status, "snapshot_run", {
      payload: { total: resultados.length, fallos },
    });
    return new Response(
      JSON.stringify({ ok: fallos === 0, total: resultados.length, fallos, resultados }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      },
    );
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[auditoria-snapshot-daily] error:", err);
    log.finish(500, "unhandled_error", { payload: { error: msg } });
    await captureEdgeException(err, { fn: "auditoria-snapshot-daily", status_code: 500 });
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
