/**
 * Servicio de tracking público y CRUD de `tracking_links`.
 * El endpoint público se consume vía edge function (`tracking-public`).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

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
  organizacion: { nombre: string; logo_url: string | null } | null;
}

/**
 * Recupera el tracking público a partir de un token firmado.
 * Usa fetch directo porque la edge function lee el token vía query-string y
 * `supabase.functions.invoke` no soporta query params.
 */
export async function fetchTrackingPublico(token: string): Promise<TrackingPublicoData> {
  void supabase;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/tracking-public?token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Error al cargar tracking");
  }
  return res.json();
}

// ─── tracking_links CRUD ──────────────────────────────────────────────────────

export async function createTrackingLink(params: {
  embarqueId: string;
  expiresAt?: string | null;
}): Promise<TrackingLinkRow> {
  const { data, error } = await supabase
    .from("tracking_links")
    .insert({
      embarque_id: params.embarqueId,
      expires_at: params.expiresAt || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
