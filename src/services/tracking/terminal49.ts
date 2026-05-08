import { supabase } from "@/integrations/supabase/client";

export interface TrackingExterno {
  id: string;
  embarque_id: string;
  provider: string;
  tracking_request_id: string | null;
  shipment_id: string | null;
  request_number: string;
  request_type: "bill_of_lading" | "booking_number" | "container";
  scac: string;
  status: string;
  failed_reason: string | null;
  last_event_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchTrackingExterno(embarqueId: string): Promise<TrackingExterno | null> {
  const { data, error } = await supabase
    .from("tracking_externo")
    .select("*")
    .eq("embarque_id", embarqueId)
    .eq("provider", "terminal49")
    .maybeSingle();
  if (error) throw error;
  return (data as TrackingExterno | null) ?? null;
}

export async function activarTrackingTerminal49(
  embarqueId: string,
  requestType: "bill_of_lading" | "booking_number" | "container" = "bill_of_lading",
) {
  const { data, error } = await supabase.functions.invoke("terminal49-create-tracking", {
    body: { embarque_id: embarqueId, request_type: requestType },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function sincronizarTrackingTerminal49(embarqueId: string) {
  const { data, error } = await supabase.functions.invoke("terminal49-sync", {
    body: { embarque_id: embarqueId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function vincularShipmentManualTerminal49(embarqueId: string, shipmentId: string) {
  const { data, error } = await supabase.functions.invoke("terminal49-link-shipment", {
    body: { embarque_id: embarqueId, shipment_id: shipmentId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function eliminarTrackingTerminal49(embarqueId: string) {
  const { error } = await supabase
    .from("tracking_externo")
    .delete()
    .eq("embarque_id", embarqueId)
    .eq("provider", "terminal49");
  if (error) throw error;
}
