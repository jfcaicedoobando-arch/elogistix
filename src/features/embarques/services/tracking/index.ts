/**
 * Servicio de tracking público y CRUD de `tracking_links`.
 * El endpoint público se consume vía edge function (`tracking-public`).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { registrarBitacoraEmbarque } from "../bitacoraEmbarques";

type TrackingLinkRow = Tables<"tracking_links">;

export interface TrackingPublicoData {
  embarque: {
    expediente: string;
    cliente_nombre: string;
    modo: string;
    tipo: string;
    estado: string;
    etd: string | null;
    eta: string | null;
    puerto_origen: string | null;
    puerto_destino: string | null;
    aeropuerto_origen: string | null;
    aeropuerto_destino: string | null;
    ciudad_origen: string | null;
    ciudad_destino: string | null;
    naviera: string | null;
    aerolinea: string | null;
    transportista: string | null;
  };
  eventos: {
    tipo: string;
    descripcion: string;
    ubicacion: string;
    fecha: string;
  }[];
  /** Avance documental visible al cliente (sin archivos ni notas internas). */
  documentos: TrackingPublicoDocumento[];
  organizacion: { nombre: string; logo_url: string | null } | null;
}

/** Documento del expediente tal como se muestra en el tracking público. */
export interface TrackingPublicoDocumento {
  nombre: string;
  estado: string;
  /** `true` si la etapa actual del embarque lo exige. */
  requerido: boolean;
  recibido: boolean;
}

/**
 * Recupera el tracking público a partir de un token firmado.
 * Usa fetch directo porque la edge function lee el token vía query-string y
 * `supabase.functions.invoke` no soporta query params.
 */
export async function fetchTrackingPublico(token: string): Promise<TrackingPublicoData> {
  void supabase;
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${baseUrl}/functions/v1/tracking-public?token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // RUX-02: la edge devuelve `code` estable (not_found/expired/…); se
    // prioriza sobre el texto (español) para traducir por código, no por literal.
    throw new Error(body.code || body.error || "Error al cargar tracking");
  }
  return res.json();
}

// ─── tracking_links CRUD ──────────────────────────────────────────────────────

/**
 * Vigencia por defecto de una liga de tracking público, alineada con la de
 * los enlaces de proforma (`generar_token_proforma`, p_dias_vigencia = 30).
 * Antes el flujo "Compartir" no pasaba `expires_at` → NULL = enlace eterno.
 */
export const TRACKING_LINK_VIGENCIA_DIAS = 30;

/** Lista las ligas de tracking de un embarque, más recientes primero. */
export async function fetchTrackingLinks(embarqueId: string): Promise<TrackingLinkRow[]> {
  const { data, error } = await supabase
    .from("tracking_links")
    .select()
    .eq("embarque_id", embarqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** ¿La liga sigue vigente? Las legacy sin `expires_at` (eternas) NO se
 *  reutilizan: compartir genera una nueva con vigencia y la eterna se puede
 *  revocar desde el menú del embarque. */
export function esTrackingLinkVigente(link: TrackingLinkRow, ahora: number = Date.now()): boolean {
  if (!link.expires_at) return false;
  return new Date(link.expires_at).getTime() > ahora;
}

/** N26: vigencias permitidas para una liga pública (la BD topa en 90 días). */
export const TRACKING_LINK_DIAS_DEFAULT = 30;
export const TRACKING_LINK_DIAS_MAX = 90;

function vigenciaPorDefecto(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString();
}

export async function createTrackingLink(params: {
  embarqueId: string;
  expiresAt?: string | null;
}): Promise<TrackingLinkRow> {
  // N26 (Ola E2 · B): ninguna liga pública puede ser eterna; si no llega
  // vigencia se usan 30 días (como un gafete de visitante que caduca).
  const expiresAt = params.expiresAt || vigenciaPorDefecto(TRACKING_LINK_DIAS_DEFAULT);
  const { data, error } = await supabase
    .from("tracking_links")
    .insert({
      embarque_id: params.embarqueId,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  await registrarBitacoraEmbarque({
    accion: "Creó liga de tracking público de embarque",
    entidadId: params.embarqueId,
    detalles: { trackingLinkId: data.id, expiraEn: params.expiresAt ?? null },
  });
  return data;
}

/** Revoca (borra) una liga de tracking público. La policy
 *  "Org staff manage tracking_links" (FOR ALL) ya lo permite a staff de la org. */
export async function deleteTrackingLink(params: {
  linkId: string;
  embarqueId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("tracking_links")
    .delete()
    .eq("id", params.linkId);
  if (error) throw error;
  await registrarBitacoraEmbarque({
    accion: "Revocó liga de tracking público de embarque",
    entidadId: params.embarqueId,
    detalles: { trackingLinkId: params.linkId },
  });
}
