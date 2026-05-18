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
  parseJsonCargoDate,
  checkPrefixVsCarrier,
  pickEffectiveEtd,
  pickEffectiveAta,
  type ComputedEvent,
  type JsonCargoContainerData,
} from "../_shared/jsoncargo.ts";

interface RequestBody { embarqueId?: string }
interface EmbarqueRow {
  id: string;
  contenedor: string | null;
  naviera: string | null;
  modo: string | null;
  organization_id: string | null;
  eta: string | null;
  etd: string | null;
  expediente: string | null;
  fecha_llegada_real: string | null;
}

const THROTTLE_MS = 10 * 60 * 1000; // 10 min entre syncs manuales

async function parseBodyId(req: Request): Promise<string | null> {
  try {
    const body: RequestBody = await req.json();
    return typeof body.embarqueId === "string" ? body.embarqueId : null;
  } catch {
    return null;
  }
}

async function loadEmbarque(auth: AuthContext, id: string): Promise<EmbarqueRow | null> {
  const { data, error } = await auth.anonClient
    .from("embarques")
    .select("id, contenedor, naviera, modo, organization_id, eta, etd, expediente, fecha_llegada_real")
    .eq("id", id)
    .maybeSingle();
  return error ? null : (data as EmbarqueRow | null);
}

interface ValidatedEmbarque {
  errorCode: string;
  status: number;
  message: string;
}

function validateEmbarqueForTracking(emb: EmbarqueRow): ValidatedEmbarque | { ok: true; shippingLine: string } {
  if (emb.modo !== "Marítimo") return { errorCode: "not_maritimo", status: 422, message: "Solo embarques marítimos" };
  if (!emb.contenedor) return { errorCode: "missing_contenedor", status: 422, message: "Embarque sin número de contenedor" };
  const shippingLine = mapNaviera(emb.naviera);
  if (!shippingLine) return {
    errorCode: "naviera_no_soportada",
    status: 422,
    message: `Naviera "${emb.naviera ?? "—"}" no soportada por JSONCargo`,
  };
  return { ok: true, shippingLine };
}

async function persistPrefixMismatch(
  auth: AuthContext,
  embarqueId: string,
  organization_id: string | null,
  contenedor: string,
  shippingLine: string,
  prefix: string | null,
  suggestions: string[],
) {
  const { data: existing } = await auth.adminClient
    .from("tracking_externo").select("id")
    .eq("embarque_id", embarqueId).eq("provider", "jsoncargo").maybeSingle();
  const reason = `Prefix ${prefix} no coincide con naviera ${shippingLine}. Sugerencias: ${suggestions.join(", ") || "—"}`;
  const payload = {
    embarque_id: embarqueId, organization_id, provider: "jsoncargo",
    request_number: contenedor, request_type: "container", scac: shippingLine,
    status: "failed", failed_reason: reason, last_synced_at: new Date().toISOString(),
    raw_payload: { error_code: "PREFIX_MISMATCH", prefix, suggestions },
  };
  if (existing) {
    await auth.adminClient.from("tracking_externo").update(payload).eq("id", existing.id);
  } else {
    await auth.adminClient.from("tracking_externo").insert(payload);
  }
  return reason;
}

function truncMinute(iso: string): string {
  return iso.slice(0, 16);
}

async function syncEventos(
  auth: AuthContext,
  embarqueId: string,
  organization_id: string | null,
  eventos: ComputedEvent[],
): Promise<number> {
  if (eventos.length === 0) return 0;
  const { data: existentes } = await auth.adminClient
    .from("eventos_embarque").select("tipo, fecha")
    .eq("embarque_id", embarqueId).eq("usuario", "jsoncargo");
  const exKeys = new Set(
    (existentes ?? []).map((e: { tipo: string; fecha: string }) => `${e.tipo}|${truncMinute(e.fecha)}`),
  );
  const nuevos = eventos.filter((ev) => !exKeys.has(`${ev.tipo}|${truncMinute(ev.fecha)}`));
  if (nuevos.length === 0) return 0;
  const { error } = await auth.adminClient.from("eventos_embarque").insert(
    nuevos.map((ev) => ({
      embarque_id: embarqueId,
      organization_id,
      tipo: ev.tipo, descripcion: ev.descripcion, ubicacion: ev.ubicacion,
      fecha: ev.fecha, usuario: "jsoncargo",
    })),
  );
  if (error) { console.warn("eventos_embarque insert error:", error.message); return 0; }
  return nuevos.length;
}

async function upsertTrackingExterno(
  auth: AuthContext,
  embarqueId: string,
  organization_id: string | null,
  contenedor: string,
  shippingLine: string,
  result: Awaited<ReturnType<typeof fetchContainerDetails>>,
) {
  const { data: existing } = await auth.adminClient
    .from("tracking_externo").select("id, last_synced_at, organization_id")
    .eq("embarque_id", embarqueId).eq("provider", "jsoncargo").maybeSingle();
  const payload = {
    embarque_id: embarqueId, organization_id, provider: "jsoncargo",
    request_number: contenedor, request_type: "container", scac: shippingLine,
    status: result.ok ? "ok" : "failed",
    failed_reason: result.ok ? null : (result.errorTitle ?? "Error desconocido"),
    last_synced_at: new Date().toISOString(),
    last_event_at: result.ok ? parseJsonCargoDate(result.data?.last_movement_timestamp ?? null) : null,
    raw_payload: result.raw ?? {},
  };
  if (existing) {
    await auth.adminClient.from("tracking_externo").update(payload).eq("id", existing.id);
  } else {
    await auth.adminClient.from("tracking_externo").insert(payload);
  }
  return existing;
}

function buildSummary(emb: EmbarqueRow, data: JsonCargoContainerData) {
  const newEtaIso = parseJsonCargoDate(data.eta_final_destination);
  const etdEffectiveRaw = pickEffectiveEtd(data);
  const newEtdIso = parseJsonCargoDate(etdEffectiveRaw);
  const ataEffective = pickEffectiveAta(data);
  const newAtaIso = parseJsonCargoDate(ataEffective.iso);
  const eta_propuesta = newEtaIso?.slice(0, 10) ?? null;
  const etd_propuesta = newEtdIso?.slice(0, 10) ?? null;
  const ata_propuesta = newAtaIso?.slice(0, 10) ?? null;
  const eta_actual = emb.eta ?? null;
  const etd_actual = emb.etd ?? null;
  const ata_actual = emb.fecha_llegada_real ?? null;
  return {
    container_status: data.container_status,
    last_location: data.last_location,
    current_vessel: data.current_vessel_name,
    current_voyage: data.current_voyage_number,
    eta_final_destination: data.eta_final_destination,
    atd_origin: data.atd_origin,
    etd_origin_effective: etdEffectiveRaw,
    etd_origin_is_estimated: !!etdEffectiveRaw && !data.atd_origin,
    shipped_from: data.shipped_from,
    shipped_to: data.shipped_to,
    last_updated: data.last_updated,
    eta_propuesta, etd_propuesta, ata_propuesta,
    eta_actual, etd_actual, ata_actual,
    eta_difiere: !!eta_propuesta && eta_propuesta !== eta_actual,
    etd_difiere: !!etd_propuesta && etd_propuesta !== etd_actual,
    ata_difiere: !!ata_propuesta && ata_propuesta !== ata_actual,
    ata_is_inferred: ataEffective.isInferred,
  };
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

  const embarqueId = await parseBodyId(req);
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

  // Validación de prefix vs naviera (evita consumir cuota)
  const prefixCheck = checkPrefixVsCarrier(contenedor, shippingLine);
  if (!prefixCheck.valid) {
    const reason = await persistPrefixMismatch(
      auth, embarqueId, embarque.organization_id, contenedor,
      shippingLine, prefixCheck.prefix, prefixCheck.suggestions,
    );
    log.finish(422, "prefix_mismatch", {
      user_id: auth.userId, organization_id: embarque.organization_id,
      payload: { embarqueId, prefix: prefixCheck.prefix, naviera: shippingLine },
    });
    return jsonResponse({
      ok: false, error_code: "PREFIX_MISMATCH",
      prefix: prefixCheck.prefix, suggestions: prefixCheck.suggestions, error: reason,
    }, 422, cors);
  }

  // Throttle por last_synced_at
  const { data: existing } = await auth.adminClient
    .from("tracking_externo").select("id, last_synced_at")
    .eq("embarque_id", embarqueId).eq("provider", "jsoncargo").maybeSingle();
  if (existing?.last_synced_at && Date.now() - new Date(existing.last_synced_at).getTime() < THROTTLE_MS) {
    log.finish(200, "throttled", {
      user_id: auth.userId, organization_id: embarque.organization_id,
      payload: { embarqueId, last_synced_at: existing.last_synced_at },
    });
    return jsonResponse({
      ok: true, throttled: true,
      message: "Sincronización reciente — espera unos minutos",
      last_synced_at: existing.last_synced_at,
    }, 200, cors);
  }

  const result = await fetchContainerDetails(apiKey, contenedor, shippingLine);
  await upsertTrackingExterno(auth, embarqueId, embarque.organization_id, contenedor, shippingLine, result);

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
});
