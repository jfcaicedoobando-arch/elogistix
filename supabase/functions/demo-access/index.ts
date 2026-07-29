// Edge function: provisiona/garantiza el usuario demo, lo agrega a la organización demo,
// re-siembra los datos de ejemplo y devuelve credenciales para que el frontend haga signIn.
// Es seguro que la contraseña sea pública: es una cuenta demo compartida.
//
// BY DESIGN (auditoría 2026-07-29, O9/S5-17): credenciales fijas a propósito —
// habilitan el botón "Ver demo" del login. No mover a secretos/vault. La
// destrucción/re-siembra está restringida a service_role/super_admin por el
// guard LC_SEED_DEMO_NO_AUTORIZADO de seed_demo_organization (M8).
// Documentación: README.md § "Cuenta demo".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { initSentryEdge, captureEdgeException } from "../_shared/sentry.ts";
import { corsHeaders } from "../_shared/cors.ts";

initSentryEdge("demo-access");


const DEMO_EMAIL = "demo@librecarga.com";
const DEMO_PASSWORD = "demo-libre-carga-2026";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Buscar usuario por email; crear si no existe.
    let userId: string | null = null;
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;
    const existing = list.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);

    if (existing) {
      userId = existing.id;
      // Resetear password e email_confirm por si cambió manualmente.
      const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Usuario Demo" },
      });
      if (updErr) throw updErr;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Usuario Demo" },
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    // 2) Asegurar membership (operador en org demo).
    const { error: memErr } = await admin.rpc("ensure_demo_membership", { _user_id: userId });
    if (memErr) throw memErr;

    // 3) Re-sembrar datos de ejemplo.
    const { error: seedErr } = await admin.rpc("seed_demo_organization");
    if (seedErr) throw seedErr;

    return new Response(
      JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err);
    console.error("demo-access error:", message, err);
    await captureEdgeException(err, { fn: "demo-access", status_code: 500 });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
