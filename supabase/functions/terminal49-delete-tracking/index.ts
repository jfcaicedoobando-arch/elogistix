// Edge function: desactiva (elimina) el tracking_externo de un embarque.
// Usa service role para evitar problemas de RLS y registra el intento en tracking_intentos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Token inválido" }, 401);

    const body = await req.json().catch(() => null);
    const embarqueId = body?.embarque_id as string | undefined;
    if (!embarqueId) return json({ error: "embarque_id requerido" }, 400);

    // Verificar que el usuario tenga acceso al embarque
    const { data: embarque, error: embErr } = await supabase
      .from("embarques")
      .select("id, organization_id")
      .eq("id", embarqueId)
      .maybeSingle();
    if (embErr || !embarque) return json({ error: "Embarque no encontrado o sin permisos" }, 404);

    // Leer la fila actual antes de borrar (para conocer tracking_request_id)
    const { data: existing } = await supabaseAdmin
      .from("tracking_externo")
      .select("id, tracking_request_id, request_number, scac, request_type")
      .eq("embarque_id", embarqueId)
      .eq("provider", "terminal49")
      .maybeSingle();

    // Intentar liberar el tracking en Terminal49 (DELETE /v2/tracking_requests/{id})
    let remoteStatus: number | null = null;
    let remoteMessage = "Sin tracking_request_id, no se llamó a Terminal49";
    let remoteOk = true;
    if (existing?.tracking_request_id) {
      const apiKey = Deno.env.get("TERMINAL49_API_KEY");
      if (!apiKey) {
        remoteOk = false;
        remoteMessage = "TERMINAL49_API_KEY no configurada — solo se borró localmente";
      } else {
        try {
          const r = await fetch(
            `https://api.terminal49.com/v2/tracking_requests/${existing.tracking_request_id}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Token ${apiKey}`,
                Accept: "application/vnd.api+json",
              },
            },
          );
          remoteStatus = r.status;
          // Consumir body para evitar leaks
          const txt = await r.text().catch(() => "");
          if (r.ok || r.status === 404) {
            remoteOk = true;
            remoteMessage =
              r.status === 404
                ? "Tracking ya no existía en Terminal49 (404, tratado como éxito)"
                : "Tracking liberado en Terminal49";
          } else {
            remoteOk = false;
            remoteMessage = `Terminal49 rechazó DELETE (HTTP ${r.status}): ${txt.slice(0, 300)}`;
            console.error("T49 DELETE error", r.status, txt);
          }
        } catch (e) {
          remoteOk = false;
          remoteMessage = "Excepción llamando a Terminal49: " + (e instanceof Error ? e.message : String(e));
          console.error("T49 DELETE exception", e);
        }
      }
    }

    // Borrar con service role (siempre, aunque T49 falle el usuario pidió desactivar)
    const { data: deleted, error: delErr } = await supabaseAdmin
      .from("tracking_externo")
      .delete()
      .eq("embarque_id", embarqueId)
      .eq("provider", "terminal49")
      .select("id, tracking_request_id, request_number, scac, request_type");

    if (delErr) {
      return json({ error: "No se pudo desactivar", details: delErr.message }, 500);
    }

    const removed = Array.isArray(deleted) ? deleted[0] : null;

    // Auditar
    const baseMsg = removed
      ? "Tracking desactivado y desvinculado del embarque"
      : "No había tracking activo (no-op)";
    await supabaseAdmin.from("tracking_intentos").insert({
      embarque_id: embarqueId,
      organization_id: embarque.organization_id,
      provider: "terminal49",
      accion: "delete",
      request_type: removed?.request_type ?? null,
      request_number: removed?.request_number ?? null,
      scac: removed?.scac ?? null,
      tracking_request_id: removed?.tracking_request_id ?? null,
      resultado: remoteOk ? "exito" : "error",
      http_status: remoteStatus,
      mensaje: `${baseMsg}. ${remoteMessage}`,
      usuario_id: userData.user.id,
      usuario_email: userData.user.email ?? "",
    });

    return json({
      ok: true,
      removed: !!removed,
      terminal49: { ok: remoteOk, status: remoteStatus, message: remoteMessage },
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
