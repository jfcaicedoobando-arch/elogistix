/**
 * Captura snapshots diarios de auditoría para todas las organizaciones activas.
 * Idempotente: la tabla `auditoria_snapshots` tiene UNIQUE(organization_id, fecha).
 *
 * Auth: requiere header X-Cron-Secret == CRON_SECRET (cron-only).
 */
// @ts-expect-error Deno remote import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  // @ts-expect-error Deno global
  const cronSecret = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("X-Cron-Secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      },
    );
  }

  try {
    // @ts-expect-error Deno global
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // @ts-expect-error Deno global
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
      resultados.push({
        org: org.nombre,
        ok: !error,
        error: error?.message,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, total: resultados.length, resultados }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    console.error("[auditoria-snapshot-daily] error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
