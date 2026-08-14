/**
 * facturapi-consultar-rep — Consulta manual (bajo demanda) del estado de un REP
 * en FacturApi y sincroniza `pagos_factura` si difiere de la BD.
 *
 * Es el equivalente por-pago del cron `facturapi-reconciliar-cancelaciones`
 * (que corre cada 30 min): permite al contador refrescar el estatus de la
 * cancelación de un REP sin esperar el barrido.
 *
 * Entrada: { pago_id: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler, captureEdgeException } from "../_shared/sentry.ts";
import { getFacturapiClient, withFacturapiTimeout } from "../_shared/facturapiClient.ts";
import { authorizeOrgRole, ROLES_CONSULTA_FISCAL } from "../_shared/auth.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { makeJson } from "../_shared/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface LocalPago {
  id: string;
  organization_id: string;
  factura_id: string;
  facturapi_rep_id: string | null;
  estado_rep: string | null;
  rep_cancellation_status: string | null;
}

interface RemoteRep { status?: string; cancellation_status?: string }

/**
 * Copia local de `resolveNextActionRep` (el bundle de Supabase sólo permite
 * archivos del mismo folder, así que no se puede importar del cron).
 */
export function resolverPatchRep(
  remote: RemoteRep,
  local: { rep_cancellation_status: string | null },
  nowIso: string,
): { outcome: string; patch: Record<string, unknown> } {
  const cs = (remote.cancellation_status ?? "").toLowerCase();
  const localCs = (local.rep_cancellation_status ?? "").toLowerCase();
  if (cs === "accepted" || remote.status === "canceled") {
    return {
      outcome: "accepted",
      patch: { estado_rep: "Cancelado", rep_cancellation_status: "accepted", rep_cancelado_en: nowIso },
    };
  }
  if (cs === localCs) return { outcome: "no_change", patch: {} };
  if (cs === "rejected" || cs === "expired") {
    return { outcome: cs, patch: { rep_cancellation_status: cs } };
  }
  if (cs) return { outcome: "transition", patch: { rep_cancellation_status: cs } };
  return { outcome: "no_change", patch: {} };
}

type Json = (body: unknown, status?: number) => Response;
type Supa = ReturnType<typeof createClient>;

/**
 * Ola 14 · R5EF-02: tope por organización para la consulta manual de estatus
 * REP (patrón fail-closed REF-07 / R4EF-03). Cada clic pega a FacturApi; sin
 * contador, un polling en bucle satura la API del PAC. 10/min por org permite
 * refrescos manuales y corta automatización abusiva.
 */
const RL_CONSULTA_REP = { windowSeconds: 60, max: 10 } as const;

/** Devuelve Response si hay que cortar (503/429); null si se puede continuar. */
async function checkRateLimitConsultaRep(
  json: Json,
  supabase: Supa,
  organizationId: string,
): Promise<Response | null> {
  const llave = `facturapi-consultar-rep:${organizationId}`;
  const { data: rl, error: rlErr } = await supabase.rpc("check_ratelimit", {
    p_key: llave,
    p_window_seconds: RL_CONSULTA_REP.windowSeconds,
    p_max: RL_CONSULTA_REP.max,
  });
  if (rlErr) {
    // Fail-CLOSED: sin contador no hay forma de saber si hay abuso.
    await captureEdgeException(new Error(`check_ratelimit failed: ${rlErr.message}`), {
      fn: "facturapi-consultar-rep",
      status_code: 503,
      extra: { llave },
    });
    return json({ error: "rate_limit_unavailable" }, 503);
  }
  const rlResult = rl as { ok?: boolean; retry_after?: number } | null;
  if (rlResult?.ok === false) {
    return json(
      {
        error: "rate_limited",
        message: "Demasiadas consultas de estatus seguidas. Espera un momento y vuelve a intentarlo.",
      },
      429,
    );
  }
  return null;
}

/** Valida método/sesión/pago y autorización. Devuelve el pago o una respuesta. */
async function resolverPago(
  req: Request,
  json: Json,
  supabase: Supa,
  userId: string,
): Promise<{ pago: LocalPago } | { resp: Response }> {
  const body = (await req.json().catch(() => ({}))) as { pago_id?: string };
  if (!body.pago_id) return { resp: json({ error: "pago_id_required" }, 400) };

  const { data, error } = await supabase
    .from("pagos_factura")
    .select("id, organization_id, factura_id, facturapi_rep_id, estado_rep, rep_cancellation_status")
    .eq("id", body.pago_id)
    .maybeSingle();
  if (error || !data) return { resp: json({ error: "pago_not_found" }, 404) };
  const pago = data as LocalPago;
  if (!pago.facturapi_rep_id || pago.facturapi_rep_id.startsWith("PENDING:")) {
    return {
      resp: json(
        { error: "rep_no_timbrado", message: "Este pago no tiene un REP timbrado que consultar." },
        409,
      ),
    };
  }
  if (!(await authorizeOrgRole(supabase, userId, pago.organization_id, ROLES_CONSULTA_FISCAL))) {
    return { resp: json({ error: "forbidden" }, 403) };
  }
  return { pago };
}

/** Trae el REP remoto desde FacturApi. */
async function traerRepRemoto(
  json: Json,
  supabase: Supa,
  pago: LocalPago,
): Promise<{ remote: RemoteRep } | { resp: Response }> {
  const resolved = await getFacturapiClient(supabase, pago.organization_id);
  if (!resolved.ok) {
    return {
      resp: json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status),
    };
  }
  try {
    const client = resolved.data.client as { invoices: { retrieve: (id: string) => Promise<unknown> } };
    const remote = (await withFacturapiTimeout(
      "invoices.retrieve",
      client.invoices.retrieve(pago.facturapi_rep_id!),
      15_000,
    )) as RemoteRep;
    return { remote };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    // Ola 14 · R5EF-03: detalle crudo sólo a log/Sentry; mensaje genérico al cliente.
    console.error("facturapi-consultar-rep invoices.retrieve:", detail);
    await captureEdgeException(err instanceof Error ? err : new Error(detail), {
      fn: "facturapi-consultar-rep",
      status_code: 502,
      extra: { op: "invoices.retrieve" },
    });
    return {
      resp: json({
        error: "facturapi_error",
        message:
          "LC_FACTURAPI_NO_DISPONIBLE: No se pudo consultar el estatus del REP en el PAC. Intenta de nuevo en unos minutos.",
      }, 502),
    };
  }
}

/** Aplica el patch resuelto; devuelve el motivo si la BD lo rechaza. */
async function sincronizarPago(
  supabase: Supa,
  pago: LocalPago,
  user: { id: string; email?: string },
  decision: { outcome: string; patch: Record<string, unknown> },
): Promise<{ actualizado: boolean; errorGuardado: string | null }> {
  if (decision.outcome === "no_change" || Object.keys(decision.patch).length === 0) {
    return { actualizado: false, errorGuardado: null };
  }
  const { error: upErr } = await supabase
    .from("pagos_factura")
    .update(decision.patch)
    .eq("id", pago.id);
  // No silenciar: si un candado de BD impide sincronizar, el contador debe verlo.
  if (upErr) return { actualizado: false, errorGuardado: upErr.message };
  await registrarBitacoraEdge(supabase, {
    organizationId: pago.organization_id,
    usuarioId: user.id,
    usuarioEmail: user.email,
    modulo: "facturacion",
    accion: "facturapi_rep_consulta_reconciliada",
    entidadId: pago.id,
    detalles: { via: "consulta_manual", outcome: decision.outcome, patch: decision.patch },
  });
  return { actualizado: true, errorGuardado: null };
}

async function handle(req: Request): Promise<Response> {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const json = makeJson(req);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const resPago = await resolverPago(req, json, supabase, userData.user.id);
  if ("resp" in resPago) return resPago.resp;
  const { pago } = resPago;

  // R5EF-02: rate limit DESPUÉS de auth+org y ANTES de pegarle a FacturApi.
  const rlResp = await checkRateLimitConsultaRep(json, supabase, pago.organization_id);
  if (rlResp) return rlResp;

  const resRemoto = await traerRepRemoto(json, supabase, pago);
  if ("resp" in resRemoto) return resRemoto.resp;
  const { remote } = resRemoto;

  const decision = resolverPatchRep(remote, pago, new Date().toISOString());
  const { actualizado, errorGuardado } = await sincronizarPago(
    supabase,
    pago,
    { id: userData.user.id, email: userData.user.email },
    decision,
  );

  return json({
    ok: errorGuardado === null,
    actualizado,
    error_guardado: errorGuardado,
    outcome: decision.outcome,
    remoto: {
      status: (remote.status ?? "").toLowerCase() || null,
      cancellation_status: (remote.cancellation_status ?? "none").toLowerCase(),
    },
    local: {
      estado_rep: pago.estado_rep,
      rep_cancellation_status: (pago.rep_cancellation_status ?? "none").toLowerCase(),
    },
  });
}

Deno.serve(wrapEdgeHandler("facturapi-consultar-rep", handle));
