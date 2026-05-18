// Helpers para la edge function jsoncargo-track. Aislados para mantener el
// handler por debajo de los límites de complejidad y líneas.

import type { AuthContext } from "./auth.ts";
import {
  fetchContainerDetails,
  parseJsonCargoDate,
  pickEffectiveEtd,
  pickEffectiveAta,
  type ComputedEvent,
  type JsonCargoContainerData,
} from "./jsoncargo.ts";

export interface EmbarqueRow {
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

export interface PrefixContext {
  embarqueId: string;
  organization_id: string | null;
  contenedor: string;
  shippingLine: string;
  prefix: string | null;
  suggestions: string[];
}

export interface TrackingContext {
  embarqueId: string;
  organization_id: string | null;
  contenedor: string;
  shippingLine: string;
  result: Awaited<ReturnType<typeof fetchContainerDetails>>;
}

export async function loadEmbarque(auth: AuthContext, id: string): Promise<EmbarqueRow | null> {
  const { data, error } = await auth.anonClient
    .from("embarques")
    .select("id, contenedor, naviera, modo, organization_id, eta, etd, expediente, fecha_llegada_real")
    .eq("id", id)
    .maybeSingle();
  return error ? null : (data as EmbarqueRow | null);
}

export async function persistPrefixMismatch(auth: AuthContext, ctx: PrefixContext): Promise<string> {
  const { data: existing } = await auth.adminClient
    .from("tracking_externo").select("id")
    .eq("embarque_id", ctx.embarqueId).eq("provider", "jsoncargo").maybeSingle();
  const reason = `Prefix ${ctx.prefix} no coincide con naviera ${ctx.shippingLine}. Sugerencias: ${ctx.suggestions.join(", ") || "—"}`;
  const payload = {
    embarque_id: ctx.embarqueId, organization_id: ctx.organization_id, provider: "jsoncargo",
    request_number: ctx.contenedor, request_type: "container", scac: ctx.shippingLine,
    status: "failed", failed_reason: reason, last_synced_at: new Date().toISOString(),
    raw_payload: { error_code: "PREFIX_MISMATCH", prefix: ctx.prefix, suggestions: ctx.suggestions },
  };
  if (existing) {
    await auth.adminClient.from("tracking_externo").update(payload).eq("id", existing.id);
  } else {
    await auth.adminClient.from("tracking_externo").insert(payload);
  }
  return reason;
}

function truncMinute(iso: string): string { return iso.slice(0, 16); }

export async function syncEventos(
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

export async function upsertTrackingExterno(auth: AuthContext, ctx: TrackingContext) {
  const { data: existing } = await auth.adminClient
    .from("tracking_externo").select("id, last_synced_at, organization_id")
    .eq("embarque_id", ctx.embarqueId).eq("provider", "jsoncargo").maybeSingle();
  const r = ctx.result;
  const payload = {
    embarque_id: ctx.embarqueId, organization_id: ctx.organization_id, provider: "jsoncargo",
    request_number: ctx.contenedor, request_type: "container", scac: ctx.shippingLine,
    status: r.ok ? "ok" : "failed",
    failed_reason: r.ok ? null : (r.errorTitle ?? "Error desconocido"),
    last_synced_at: new Date().toISOString(),
    last_event_at: r.ok ? parseJsonCargoDate(r.data?.last_movement_timestamp ?? null) : null,
    raw_payload: r.raw ?? {},
  };
  if (existing) {
    await auth.adminClient.from("tracking_externo").update(payload).eq("id", existing.id);
  } else {
    await auth.adminClient.from("tracking_externo").insert(payload);
  }
  return existing;
}

export function buildSummary(emb: EmbarqueRow, data: JsonCargoContainerData) {
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
