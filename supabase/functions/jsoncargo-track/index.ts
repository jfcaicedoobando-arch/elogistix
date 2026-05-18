// Edge function: jsoncargo-track
// Sincroniza el tracking de un embarque marítimo contra JSONCargo.
// Auth: JWT requerido (admin/operador del embarque).

import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate, type AuthContext } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  fetchContainerDetails,
  mapNaviera,
  deriveEventsFromContainer,
  checkPrefixVsCarrier,
} from "../_shared/jsoncargo.ts";
import {
  loadEmbarque,
  persistPrefixMismatch,
  syncEventos,
  upsertTrackingExterno,
  buildSummary,
  type EmbarqueRow,
} from "../_shared/jsoncargoSync.ts";

interface RequestBody { embarqueId?: string }
const THROTTLE_MS = 10 * 60 * 1000;

async function parseBodyId(req: Request): Promise<string | null> {
  try {
    const body: RequestBody = await req.json();
    return typeof body.embarqueId === "string" ? body.embarqueId : null;
  } catch {
    return null;
  }
}

function validateEmbarqueForTracking(
  emb: EmbarqueRow,
): { errorCode: string; status: number; message: string } | { ok: true; shippingLine: string } {
  if (emb.modo !== "Marítimo") return { errorCode: "not_maritimo", status: 422, message: "Solo embarques marítimos" };
  if (!emb.contenedor) return { errorCode: "missing_contenedor", status: 422, message: "Embarque sin número de contenedor" };
  const shippingLine = mapNaviera(emb.naviera);
  if (!shippingLine) {
    return { errorCode: "naviera_no_soportada", status: 422, message: `Naviera "${emb.naviera ?? "—"}" no soportada por JSONCargo` };
  }
  return { ok: true, shippingLine };
}

async function getThrottle(auth: AuthContext, embarqueId: string): Promise<string | null> {
  const { data } = await auth.adminClient
    .from("tracking_externo").select("last_synced_at")
    .eq("embarque_id", embarqueId).eq("provider", "jsoncargo").maybeSingle();
  if (!data?.last_synced_at) return null;
  if (Date.now() - new Date(data.last_synced_at).getTime() < THROTTLE_MS) return data.last_synced_at;
  return null;
}

interface SyncEnv { req: Request; auth: AuthContext; apiKey: string; log: ReturnType<typeof createLogger>; cors: Record<string, string>; }

async function runSync(env: SyncEnv): Promise<Response> {
  const { auth, apiKey, log, cors } = env;
  const embarqueId = await parseBodyId(env.req);
  if (!embarqueId) {
    log.finish(400, "missing_embarque_id", { user_id: auth.userId });
    return errorResponse("embarqueId requerido", 400, cors);
  }

  const embarque = await loadEmbarque(auth, embarqueId);
  if (!embarque) {
    log.finish(404, "embarque_not_found", { user_id: auth.userId, payload: { embarqueId } });
    return errorResponse("Embarque no encontrado o sin acceso", 404, cors);
  }

  const validation = validateEmbarqueForTracking(embarque);
  if (!("ok" in validation)) {
    log.finish(validation.status, validation.errorCode, {
      user_id: auth.userId, organization_id: embarque.organization_id,
      payload: { embarqueId, naviera: embarque.naviera, modo: embarque.modo },
    });
    return errorResponse(validation.message, validation.status, cors);
  }
  const { shippingLine } = validation;
  const contenedor = embarque.contenedor!;

  const prefixCheck = checkPrefixVsCarrier(contenedor, shippingLine);
  if (!prefixCheck.valid) {
    const reason = await persistPrefixMismatch(auth, {
      embarqueId, organization_id: embarque.organization_id, contenedor,
      shippingLine, prefix: prefixCheck.prefix, suggestions: prefixCheck.suggestions,
    });
    log.finish(422, "prefix_mismatch", {
      user_id: auth.userId, organization_id: embarque.organization_id,
      payload: { embarqueId, prefix: prefixCheck.prefix, naviera: shippingLine },
    });
    return jsonResponse({
      ok: false, error_code: "PREFIX_MISMATCH",
      prefix: prefixCheck.prefix, suggestions: prefixCheck.suggestions, error: reason,
    }, 422, cors);
  }

  const throttledAt = await getThrottle(auth, embarqueId);
  if (throttledAt) {
    log.finish(200, "throttled", {
      user_id: auth.userId, organization_id: embarque.organization_id,
      payload: { embarqueId, last_synced_at: throttledAt },
    });
    return jsonResponse({
      ok: true, throttled: true,
      message: "Sincronización reciente — espera unos minutos",
      last_synced_at: throttledAt,
    }, 200, cors);
  }

  const result = await fetchContainerDetails(apiKey, contenedor, shippingLine);
  await upsertTrackingExterno(auth, { embarqueId, organization_id: embarque.organization_id, contenedor, shippingLine, result });

  if (!result.ok || !result.data) {
    log.finish(200, "provider_failed", {
      user_id: auth.userId, organization_id: embarque.organization_id,
      payload: { embarqueId, provider_status: result.status, error: result.errorTitle },
    });
    return jsonResponse({ ok: false, status: result.status, error: result.errorTitle ?? "Error JSONCargo" }, 200, cors);
  }

  const eventos = deriveEventsFromContainer(result.data);
  const eventosCreados = await syncEventos(auth, embarqueId, embarque.organization_id, eventos);
  const summary = buildSummary(embarque, result.data);

  log.finish(200, "sync_ok", {
    user_id: auth.userId, organization_id: embarque.organization_id,
    payload: {
      embarqueId, eventos_creados: eventosCreados,
      eta_difiere: summary.eta_difiere, etd_difiere: summary.etd_difiere, ata_difiere: summary.ata_difiere,
    },
  });
  return jsonResponse({ ok: true, eventos_creados: eventosCreados, summary }, 200, cors);
}

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "jsoncargo-track");

  if (req.method !== "POST") {
    log.finish(405, "method_not_allowed");
    return errorResponse("Method not allowed", 405, cors);
  }

  // @ts-expect-error Deno global
  const apiKey = Deno.env.get("JSONCARGO_API_KEY");
  if (!apiKey) {
    log.finish(500, "missing_api_key");
    return errorResponse("JSONCARGO_API_KEY no configurada", 500, cors);
  }

  let auth: AuthContext;
  try {
    auth = await authenticate(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "auth error";
    log.finish(401, "auth_failed", { payload: { error: msg } });
    return errorResponse(msg.replace(/^401:/, ""), 401, cors);
  }

  return runSync({ req, auth, apiKey, log, cors });
});
