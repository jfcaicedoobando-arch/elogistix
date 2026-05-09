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

    // Borrar con service role
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
    await supabaseAdmin.from("tracking_intentos").insert({
      embarque_id: embarqueId,
      organization_id: embarque.organization_id,
      provider: "terminal49",
      accion: "delete",
      request_type: removed?.request_type ?? null,
      request_number: removed?.request_number ?? null,
      scac: removed?.scac ?? null,
      tracking_request_id: removed?.tracking_request_id ?? null,
      resultado: "exito",
      mensaje: removed
        ? "Tracking desactivado y desvinculado del embarque"
        : "No había tracking activo (no-op)",
      usuario_id: userData.user.id,
      usuario_email: userData.user.email ?? "",
    });

    return json({ ok: true, removed: !!removed });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
