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
import { wrapEdgeHandler } from "../_shared/sentry.ts";
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

  const body = (await req.json().catch(() => ({}))) as { pago_id?: string };
  if (!body.pago_id) return json({ error: "pago_id_required" }, 400);

  const { data, error } = await supabase
    .from("pagos_factura")
    .select("id, organization_id, factura_id, facturapi_rep_id, estado_rep, rep_cancellation_status")
    .eq("id", body.pago_id)
    .maybeSingle();
  if (error || !data) return json({ error: "pago_not_found" }, 404);
  const pago = data as LocalPago;
  if (!pago.facturapi_rep_id || pago.facturapi_rep_id.startsWith("PENDING:")) {
    return json({ error: "rep_no_timbrado", message: "Este pago no tiene un REP timbrado que consultar." }, 409);
  }

  if (!(await authorizeOrgRole(supabase, userData.user.id, pago.organization_id, ROLES_CONSULTA_FISCAL))) {
    return json({ error: "forbidden" }, 403);
  }

  const resolved = await getFacturapiClient(supabase, pago.organization_id);
  if (!resolved.ok) {
    return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  }
  let remote: RemoteRep;
  try {
    const client = resolved.data.client as { invoices: { retrieve: (id: string) => Promise<unknown> } };
    remote = await withFacturapiTimeout(
      "invoices.retrieve",
      client.invoices.retrieve(pago.facturapi_rep_id),
      15_000,
    ) as RemoteRep;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: "facturapi_error", message: detail }, 502);
  }

  const decision = resolverPatchRep(remote, pago, new Date().toISOString());
  let actualizado = false;
  let errorGuardado: string | null = null;
  if (decision.outcome !== "no_change" && Object.keys(decision.patch).length > 0) {
    const { error: upErr } = await supabase.from("pagos_factura").update(decision.patch).eq("id", pago.id);
    if (upErr) {
      // No silenciar: si un candado de BD impide sincronizar, el contador debe verlo.
      errorGuardado = upErr.message;
    } else {
      actualizado = true;
      await registrarBitacoraEdge(supabase, {
        organizationId: pago.organization_id,
        usuarioId: userData.user.id,
        usuarioEmail: userData.user.email,
        modulo: "facturacion",
        accion: "facturapi_rep_consulta_reconciliada",
        entidadId: pago.id,
        detalles: { via: "consulta_manual", outcome: decision.outcome, patch: decision.patch },
      });
    }
  }

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
