/**
 * Servicio Embarque — JSONCargo & utilidades adicionales que antes vivían
 * en hooks (`useJsonCargoTracking`, `useJsonCargoBolLookup`, mutations extra).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  buildFechasUpdate,
  shouldAvanzarArribo,
  registrarEventoArribo,
  type ApplyFechasArgs,
} from "./jsoncargoFechas";

export interface BolLookupResponse {
  ok: boolean;
  bill_of_lading?: string;
  shipping_line_name?: string;
  shipping_line_id?: string;
  associated_containers?: number;
  associated_container_numbers?: string[];
  last_updated?: string;
  current_contenedor?: string | null;
  error?: string;
  status?: number;
}

export interface TrackingExternoRow {
  id: string;
  embarque_id: string;
  provider: string;
  status: string;
  failed_reason: string | null;
  last_synced_at: string | null;
  last_event_at: string | null;
  raw_payload: unknown;
  scac: string | null;
  request_number: string | null;
}

export interface JsonCargoSyncResponse {
  ok: boolean;
  throttled?: boolean;
  message?: string;
  eventos_creados?: number;
  summary?: unknown;
  error?: string;
}

const TRACKING_COLS =
  "id, embarque_id, provider, status, failed_reason, last_synced_at, last_event_at, raw_payload, scac, request_number";

export async function fetchJsonCargoTracking(embarqueId: string): Promise<TrackingExternoRow | null> {
  const { data, error } = await supabase
    .from("tracking_externo")
    .select(TRACKING_COLS)
    .eq("embarque_id", embarqueId)
    .eq("provider", "jsoncargo")
    .maybeSingle();
  if (error) throw error;
  return (data as TrackingExternoRow | null) ?? null;
}

export async function invokeJsonCargoTrack(embarqueId: string): Promise<JsonCargoSyncResponse> {
  const { data, error } = await supabase.functions.invoke<JsonCargoSyncResponse>("jsoncargo-track", {
    body: { embarqueId },
  });
  if (error) throw error;
  return data!;
}

export async function invokeJsonCargoBolLookup(embarqueId: string): Promise<BolLookupResponse> {
  const { data, error } = await supabase.functions.invoke<BolLookupResponse>("jsoncargo-bol-lookup", {
    body: { embarqueId },
  });
  if (error) throw error;
  return data!;
}

/** Fire-and-forget: no lanza si falla, sólo retorna boolean. */
export function invokeJsonCargoTrackBackground(embarqueId: string): Promise<unknown> {
  return supabase.functions.invoke("jsoncargo-track", { body: { embarqueId } });
}

export interface ApplyJsonCargoFechasResult {
  applied: boolean;
  avanzaArribo?: boolean;
}

export async function applyJsonCargoFechas(args: ApplyFechasArgs): Promise<ApplyJsonCargoFechasResult> {
  const update = buildFechasUpdate({ eta: args.eta, etd: args.etd, ata: args.ata });
  if (Object.keys(update).length === 0) return { applied: false };

  const avanzaArribo = await shouldAvanzarArribo(args.embarqueId, args.ata);
  if (avanzaArribo) update.estado = "Arribo";

  const { data, error } = await supabase
    .from("embarques")
    .update(update)
    .eq("id", args.embarqueId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("No se pudo actualizar el embarque. Verifica permisos o que el registro exista.");
  }

  if (avanzaArribo && args.ata) await registrarEventoArribo(args.embarqueId, args.ata);
  return { applied: true, avanzaArribo };
}

export async function createDocumentoEmbarqueRow(params: {
  embarqueId: string;
  nombre: string;
  notas?: string;
}): Promise<void> {
  const { error } = await supabase
    .from("documentos_embarque")
    .insert({
      embarque_id: params.embarqueId,
      nombre: params.nombre,
      estado: "Pendiente",
      notas: params.notas ?? null,
    });
  if (error) throw error;
}
