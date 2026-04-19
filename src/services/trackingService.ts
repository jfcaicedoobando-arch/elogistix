import { supabase } from "@/integrations/supabase/client";

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
 * Recupera el tracking público de un embarque mediante token firmado.
 * Encapsula la llamada a la edge function `tracking-public`.
 */
export async function fetchTrackingPublico(token: string): Promise<TrackingPublicoData> {
  const { data, error } = await supabase.functions.invoke<TrackingPublicoData>(
    "tracking-public",
    { method: "GET", body: undefined, headers: {}, ...({ query: { token } } as object) },
  );
  // supabase-js v2 no soporta `query` en invoke; hacemos fallback a fetch directo
  // si el SDK no propaga el query string.
  if (error || !data) {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/tracking-public?token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Error al cargar tracking");
    }
    return res.json();
  }
  return data;
}
