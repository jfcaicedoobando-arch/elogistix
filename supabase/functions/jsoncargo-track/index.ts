// Edge function: jsoncargo-track
// Sincroniza el tracking de un embarque marítimo contra JSONCargo.
// Auth: JWT requerido (admin/operador del embarque).

import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
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
} from "../_shared/jsoncargo.ts";

interface RequestBody {
  embarqueId?: string;
}

const THROTTLE_MS = 10 * 60 * 1000; // 10 min entre syncs manuales

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

  let auth;
  try {
    auth = await authenticate(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "auth error";
    log.finish(401, "auth_failed", { payload: { error: msg } });
    return errorResponse(msg.replace(/^401:/, ""), 401, cors);
  }

  let body: RequestBody = {};
  try { body = await req.json(); } catch { /* */ }
  const embarqueId = body.embarqueId;
  if (!embarqueId || typeof embarqueId !== "string") {
    log.finish(400, "missing_embarque_id", { user_id: auth.userId });
    return errorResponse("embarqueId requerido", 400, cors);
  }

  // Lee embarque con anonClient (RLS valida acceso del usuario)
  const { data: embarque, error: embErr } = await auth.anonClient
    .from("embarques")
    .select("id, contenedor, naviera, modo, organization_id, eta, etd, expediente, fecha_llegada_real")
    .eq("id", embarqueId)
    .maybeSingle();
  if (embErr || !embarque) {
    log.finish(404, "embarque_not_found", { user_id: auth.userId, payload: { embarqueId } });
    return errorResponse("Embarque no encontrado o sin acceso", 404, cors);
  }

  if (embarque.modo !== "Marítimo") {
    log.finish(422, "not_maritimo", {
      user_id: auth.userId,
      organization_id: embarque.organization_id,
      payload: { embarqueId, modo: embarque.modo },
    });
    return errorResponse("Solo embarques marítimos", 422, cors);
  }
  if (!embarque.contenedor) {
    log.finish(422, "missing_contenedor", {
      user_id: auth.userId,
      organization_id: embarque.organization_id,
      payload: { embarqueId },
    });
    return errorResponse("Embarque sin número de contenedor", 422, cors);
  }
  const shippingLine = mapNaviera(embarque.naviera);
  if (!shippingLine) {
    log.finish(422, "naviera_no_soportada", {
      user_id: auth.userId,
      organization_id: embarque.organization_id,
      payload: { embarqueId, naviera: embarque.naviera },
    });
    return errorResponse(`Naviera "${embarque.naviera ?? "—"}" no soportada por JSONCargo`, 422, cors);
  }

  // Validación de prefix vs naviera (evita consumir cuota)
  const prefixCheck = checkPrefixVsCarrier(embarque.contenedor, shippingLine);
  if (!prefixCheck.valid) {
    // Persistir el estado para que el batch no reintente
    const { data: existingPm } = await auth.adminClient
      .from("tracking_externo")
      .select("id")
      .eq("embarque_id", embarqueId)
      .eq("provider", "jsoncargo")
      .maybeSingle();
    const reason = `Prefix ${prefixCheck.prefix} no coincide con naviera ${shippingLine}. Sugerencias: ${prefixCheck.suggestions.join(", ") || "—"}`;
    const payload = {
      embarque_id: embarqueId,
      organization_id: embarque.organization_id,
      provider: "jsoncargo",
      request_number: embarque.contenedor,
      request_type: "container",
      scac: shippingLine,
      status: "failed",
      failed_reason: reason,
      last_synced_at: new Date().toISOString(),
      raw_payload: { error_code: "PREFIX_MISMATCH", prefix: prefixCheck.prefix, suggestions: prefixCheck.suggestions },
    };
    if (existingPm) {
      await auth.adminClient.from("tracking_externo").update(payload).eq("id", existingPm.id);
    } else {
      await auth.adminClient.from("tracking_externo").insert(payload);
    }
    return jsonResponse({
      ok: false,
      error_code: "PREFIX_MISMATCH",
      prefix: prefixCheck.prefix,
      suggestions: prefixCheck.suggestions,
      error: reason,
    }, 422, cors);
  }

  // Throttle por last_synced_at
  const { data: existing } = await auth.adminClient
    .from("tracking_externo")
    .select("id, last_synced_at, organization_id")
    .eq("embarque_id", embarqueId)
    .eq("provider", "jsoncargo")
    .maybeSingle();

  if (existing?.last_synced_at) {
    const lastSync = new Date(existing.last_synced_at).getTime();
    if (Date.now() - lastSync < THROTTLE_MS) {
      return jsonResponse({
        ok: true,
        throttled: true,
        message: "Sincronización reciente — espera unos minutos",
        last_synced_at: existing.last_synced_at,
      }, 200, cors);
    }
  }

  const result = await fetchContainerDetails(apiKey, embarque.contenedor, shippingLine);

  // Upsert tracking_externo
  const trackingPayload = {
    embarque_id: embarqueId,
    organization_id: embarque.organization_id,
    provider: "jsoncargo",
    request_number: embarque.contenedor,
    request_type: "container",
    scac: shippingLine,
    status: result.ok ? "ok" : "failed",
    failed_reason: result.ok ? null : (result.errorTitle ?? "Error desconocido"),
    last_synced_at: new Date().toISOString(),
    last_event_at: result.ok ? parseJsonCargoDate(result.data?.last_movement_timestamp ?? null) : null,
    raw_payload: result.raw ?? {},
  };

  if (existing) {
    await auth.adminClient.from("tracking_externo")
      .update(trackingPayload).eq("id", existing.id);
  } else {
    await auth.adminClient.from("tracking_externo").insert(trackingPayload);
  }

  if (!result.ok || !result.data) {
    return jsonResponse({
      ok: false,
      status: result.status,
      error: result.errorTitle ?? "Error JSONCargo",
    }, 200, cors);
  }

  // Sincroniza eventos (idempotente: por tipo + fecha truncada al minuto)
  const eventos = deriveEventsFromContainer(result.data);
  let eventosCreados = 0;
  if (eventos.length > 0) {
    const { data: existentes } = await auth.adminClient
      .from("eventos_embarque")
      .select("tipo, fecha")
      .eq("embarque_id", embarqueId)
      .eq("usuario", "jsoncargo");

    const exKeys = new Set(
      (existentes ?? []).map((e: { tipo: string; fecha: string }) =>
        `${e.tipo}|${truncMinute(e.fecha)}`),
    );

    const nuevos = eventos.filter((ev: ComputedEvent) =>
      !exKeys.has(`${ev.tipo}|${truncMinute(ev.fecha)}`));

    if (nuevos.length > 0) {
      const { error: insErr } = await auth.adminClient
        .from("eventos_embarque")
        .insert(nuevos.map((ev) => ({
          embarque_id: embarqueId,
          organization_id: embarque.organization_id,
          tipo: ev.tipo,
          descripcion: ev.descripcion,
          ubicacion: ev.ubicacion,
          fecha: ev.fecha,
          usuario: "jsoncargo",
        })));
      if (!insErr) eventosCreados = nuevos.length;
      else console.warn("eventos_embarque insert error:", insErr.message);
    }
  }

  // Propone (sin aplicar) cambios de ETA/ETD/ATA: la UI pide confirmación al usuario.
  const newEtaIso = parseJsonCargoDate(result.data.eta_final_destination);
  const etdEffectiveRaw = pickEffectiveEtd(result.data);
  const newEtdIso = parseJsonCargoDate(etdEffectiveRaw);
  const ataEffective = pickEffectiveAta(result.data);
  const newAtaIso = parseJsonCargoDate(ataEffective.iso);
  const etaPropuesta = newEtaIso ? newEtaIso.slice(0, 10) : null;
  const etdPropuesta = newEtdIso ? newEtdIso.slice(0, 10) : null;
  const ataPropuesta = newAtaIso ? newAtaIso.slice(0, 10) : null;
  const etaActual = embarque.eta ?? null;
  const etdActual = embarque.etd ?? null;
  const ataActual = embarque.fecha_llegada_real ?? null;
  const etaDifiere = !!etaPropuesta && etaPropuesta !== etaActual;
  const etdDifiere = !!etdPropuesta && etdPropuesta !== etdActual;
  const ataDifiere = !!ataPropuesta && ataPropuesta !== ataActual;

  return jsonResponse({
    ok: true,
    eventos_creados: eventosCreados,
    summary: {
      container_status: result.data.container_status,
      last_location: result.data.last_location,
      current_vessel: result.data.current_vessel_name,
      current_voyage: result.data.current_voyage_number,
      eta_final_destination: result.data.eta_final_destination,
      atd_origin: result.data.atd_origin,
      etd_origin_effective: etdEffectiveRaw,
      etd_origin_is_estimated: !!etdEffectiveRaw && !result.data.atd_origin,
      shipped_from: result.data.shipped_from,
      shipped_to: result.data.shipped_to,
      last_updated: result.data.last_updated,
      eta_propuesta: etaPropuesta,
      etd_propuesta: etdPropuesta,
      ata_propuesta: ataPropuesta,
      eta_actual: etaActual,
      etd_actual: etdActual,
      ata_actual: ataActual,
      eta_difiere: etaDifiere,
      etd_difiere: etdDifiere,
      ata_difiere: ataDifiere,
      ata_is_inferred: ataEffective.isInferred,
    },
  }, 200, cors);
});

function truncMinute(iso: string): string {
  return iso.slice(0, 16); // "YYYY-MM-DDTHH:MM"
}
