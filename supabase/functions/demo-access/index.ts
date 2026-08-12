// Edge function: provisiona/garantiza el usuario demo, lo agrega a la organización demo,
// re-siembra los datos de ejemplo y devuelve credenciales para que el frontend haga signIn.
// Es seguro que la contraseña sea pública: es una cuenta demo compartida.
//
// BY DESIGN (auditoría 2026-07-29, O9/S5-17): credenciales fijas a propósito —
// habilitan el botón "Ver demo" del login. No mover a secretos/vault. La
// destrucción/re-siembra está restringida a service_role/super_admin por el
// guard LC_SEED_DEMO_NO_AUTORIZADO de seed_demo_organization (M8).
// Documentación: README.md § "Cuenta demo".

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { initSentryEdge, captureEdgeException } from "../_shared/sentry.ts";
import { corsHeaders } from "../_shared/cors.ts";

initSentryEdge("demo-access");


const DEMO_EMAIL = "demo@librecarga.com";
const DEMO_PASSWORD = "demo-libre-carga-2026";
const SEED_SKIP_MS = 10 * 60_000;

function jsonRes(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
    status,
  });
}

function ipDeRequest(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
}

/**
 * EF-09: rate limit persistente fail-CLOSED (patrón client-error-log N51).
 * El endpoint es público por diseño; sin esto cada request re-sembraba
 * destructivamente la org demo (costo/DoS y carreras de seed).
 * Devuelve una Response cuando hay que cortar, o null si se puede continuar.
 */
async function limitarPeticiones(admin: SupabaseClient, req: Request): Promise<Response | null> {
  const { data: rl, error: rlErr } = await admin.rpc("check_ratelimit", {
    p_key: `demo-access:${ipDeRequest(req)}`,
    p_window_seconds: 60,
    p_max: 5,
  });
  if (rlErr) {
    console.error("demo-access ratelimit rpc failed:", rlErr.message);
    await captureEdgeException(new Error(`check_ratelimit failed: ${rlErr.message}`), {
      fn: "demo-access",
      status_code: 503,
    });
    return jsonRes({ error: "rate_limit_unavailable" }, 503, { "Retry-After": "30" });
  }
  const rlResult = rl as { ok?: boolean; retry_after?: number } | null;
  if (rlResult?.ok === false) {
    return jsonRes({ error: "rate_limited" }, 429, { "Retry-After": String(rlResult.retry_after ?? 60) });
  }
  return null;
}

/** Busca el usuario demo por email y lo crea (o resetea su password) según el caso. */
async function asegurarUsuarioDemo(admin: SupabaseClient): Promise<string> {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);

  if (existing) {
    // Resetear password e email_confirm por si cambió manualmente.
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Usuario Demo" },
    });
    if (updErr) throw updErr;
    return existing.id;
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Usuario Demo" },
  });
  if (createErr) throw createErr;
  return created.user!.id;
}

/**
 * Re-siembra los datos de ejemplo — EF-09: omitir si se sembró hace <10 min
 * (cada llamada re-sembraba destructivamente).
 */
async function resembrarSiHaceFalta(admin: SupabaseClient): Promise<void> {
  const { data: seedState } = await admin
    .from("demo_seed_state")
    .select("last_seeded_at")
    .eq("id", true)
    .maybeSingle();
  const ultimo = seedState?.last_seeded_at as string | null | undefined;
  const seededRecientemente = !!ultimo && (Date.now() - new Date(ultimo).getTime()) < SEED_SKIP_MS;
  if (seededRecientemente) return;

  const { error: seedErr } = await admin.rpc("seed_demo_organization");
  if (seedErr) throw seedErr;
  await admin.from("demo_seed_state").upsert({ id: true, last_seeded_at: new Date().toISOString() });
}

function mensajeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return JSON.stringify(err);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const corte = await limitarPeticiones(admin, req);
    if (corte) return corte;

    const userId = await asegurarUsuarioDemo(admin);

    // Asegurar membership (operador en org demo).
    const { error: memErr } = await admin.rpc("ensure_demo_membership", { _user_id: userId });
    if (memErr) throw memErr;

    await resembrarSiHaceFalta(admin);

    return jsonRes({ email: DEMO_EMAIL, password: DEMO_PASSWORD }, 200);
  } catch (err) {
    const message = mensajeError(err);
    console.error("demo-access error:", message, err);
    await captureEdgeException(err, { fn: "demo-access", status_code: 500 });
    return jsonRes({ error: message }, 500);
  }
});
