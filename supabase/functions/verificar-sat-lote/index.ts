/**
 * verificar-sat-lote — Barrido masivo del estatus de CFDI en el SAT para las
 * facturas de proveedor nacional de una organización (invocado por el usuario
 * desde la app).
 *
 * Entrada (POST, JSON opcional):
 *   {
 *     limite?: number,               // default 50, máx 50 (EF-05: el lote no
 *                                    // cabe en el wall-clock de la edge)
 *     solo_sin_verificar?: boolean,  // default false (revisa también las ya verificadas)
 *     organization_id?: string       // default: la organización del usuario
 *   }
 *
 * REF-07: rate limit 1 corrida/min por organización (check_ratelimit) — cada
 * corrida dispara hasta 50 consultas SOAP al SAT.
 *
 * Salida:
 *   { total, procesadas, resumen, canceladas, fallos }
 *
 * La lógica del barrido vive en `../_shared/satBarrido.ts` (compartida con
 * `verificar-sat-semanal`). Actualiza únicamente `uuid_verificado`,
 * `uuid_estatus_sat` y `uuid_verificado_fecha`.
 *
 * v13.710.0
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler, captureEdgeException } from "../_shared/sentry.ts";
import { jsonResponse } from "../_shared/response.ts";
import { authenticate, authorizeOrgMembership } from "../_shared/auth.ts";
import {
  barrerOrganizacion,
  cargarFacturas,
  parseLimite,
  rfcOrganizacion,
  type FilaFactura,
} from "../_shared/satBarrido.ts";

async function orgDelUsuario(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (data as { organization_id?: string } | null)?.organization_id ?? null;
}

Deno.serve(wrapEdgeHandler("verificar-sat-lote", async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, cors);

  let ctx: Awaited<ReturnType<typeof authenticate>>;
  try {
    ctx = await authenticate(req);
  } catch {
    return jsonResponse({ error: "unauthorized" }, 401, cors);
  }
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: { limite?: unknown; solo_sin_verificar?: boolean; organization_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const orgId = body.organization_id ?? (await orgDelUsuario(admin, ctx.userId));
  if (!orgId) return jsonResponse({ error: "organizacion_no_encontrada" }, 422, cors);
  const permitido = await authorizeOrgMembership(admin, ctx.userId, orgId);
  if (!permitido) return jsonResponse({ error: "forbidden" }, 403, cors);

  // REF-07: throttle por organización (fail-CLOSED, patrón demo-access EF-09).
  // Sin esto, cualquier miembro podía invocar en bucle y provocar throttling o
  // bloqueo del RFC de la organización por parte del SAT.
  const { data: rl, error: rlErr } = await admin.rpc("check_ratelimit", {
    p_key: `verificar-sat-lote:${orgId}`,
    p_window_seconds: 60,
    p_max: 1,
  });
  if (rlErr) {
    await captureEdgeException(new Error(`check_ratelimit failed: ${rlErr.message}`), {
      fn: "verificar-sat-lote",
      status_code: 503,
    });
    return jsonResponse({ error: "rate_limit_unavailable" }, 503, cors);
  }
  const rlResult = rl as { ok?: boolean; retry_after?: number } | null;
  if (rlResult?.ok === false) {
    return jsonResponse(
      { error: "rate_limited", message: "El barrido SAT ya corrió hace menos de 1 minuto; espera e intenta de nuevo." },
      429,
      { ...cors, "Retry-After": String(rlResult.retry_after ?? 60) },
    );
  }

  const rfcReceptor = await rfcOrganizacion(admin, orgId);
  if (!rfcReceptor) return jsonResponse({ error: "rfc_organizacion_faltante" }, 422, cors);

  let facturas: FilaFactura[];
  try {
    facturas = await cargarFacturas(
      admin,
      orgId,
      body.solo_sin_verificar === true,
      parseLimite(body.limite),
    );
  } catch (e) {
    await captureEdgeException(e, { fn: "verificar-sat-lote", extra: { orgId } });
    return jsonResponse({ error: "query_failed", detail: (e as Error).message }, 500, cors);
  }

  const out = await barrerOrganizacion(admin, orgId, facturas, rfcReceptor);

  console.log("[verificar-sat-lote] resumen", JSON.stringify({ orgId, ...out.resumen, canceladas: out.canceladas.length }));
  return jsonResponse(out, 200, cors);
}));
