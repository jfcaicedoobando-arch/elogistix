import { supabase } from "@/integrations/supabase/client";

export interface TrackingIntento {
  id: string;
  embarque_id: string;
  provider: string;
  accion: string;
  request_type: string | null;
  request_number: string | null;
  scac: string | null;
  resultado: "exito" | "error" | "duplicado" | string;
  http_status: number | null;
  tracking_request_id: string | null;
  mensaje: string | null;
  detalle: unknown;
  usuario_email: string | null;
  created_at: string;
}

export async function fetchTrackingIntentos(embarqueId: string): Promise<TrackingIntento[]> {
  const { data, error } = await supabase
    .from("tracking_intentos")
    .select("*")
    .eq("embarque_id", embarqueId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as TrackingIntento[];
}
