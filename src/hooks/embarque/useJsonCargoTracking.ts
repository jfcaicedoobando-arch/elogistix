import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query";
import { mapNavieraToJsonCargo, type JsonCargoShippingLine } from "@/lib/jsoncargo/navieras";
import { validatePrefixMatchesNaviera } from "@/lib/jsoncargo/containerPrefixes";

export class PrefixMismatchError extends Error {
  code = "PREFIX_MISMATCH" as const;
  constructor(
    public prefix: string,
    public naviera: string | null,
    public suggestions: JsonCargoShippingLine[],
  ) {
    super(`Prefix ${prefix} no coincide con naviera ${naviera ?? "—"}`);
  }
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

export interface JsonCargoSummary {
  container_status?: string;
  last_location?: string;
  current_vessel?: string;
  current_voyage?: string;
  eta_final_destination?: string;
  atd_origin?: string;
  shipped_from?: string;
  shipped_to?: string;
  last_updated?: string;
  eta_propuesta?: string | null;
  etd_propuesta?: string | null;
  eta_actual?: string | null;
  etd_actual?: string | null;
  eta_difiere?: boolean;
  etd_difiere?: boolean;
}

export function useJsonCargoTracking(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.jsonCargo.byEmbarque(embarqueId),
    queryFn: async (): Promise<TrackingExternoRow | null> => {
      if (!embarqueId) return null;
      const { data, error } = await supabase
        .from("tracking_externo")
        .select("id, embarque_id, provider, status, failed_reason, last_synced_at, last_event_at, raw_payload, scac, request_number")
        .eq("embarque_id", embarqueId)
        .eq("provider", "jsoncargo")
        .maybeSingle();
      if (error) throw error;
      return (data as TrackingExternoRow | null) ?? null;
    },
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
}

interface SyncResponse {
  ok: boolean;
  throttled?: boolean;
  message?: string;
  eventos_creados?: number;
  summary?: JsonCargoSummary;
  error?: string;
}

export interface SyncArgs {
  embarqueId: string;
  contenedor?: string | null;
  naviera?: string | null;
}

export function useSyncJsonCargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: SyncArgs): Promise<SyncResponse> => {
      const sl = mapNavieraToJsonCargo(args.naviera);
      const validation = validatePrefixMatchesNaviera(args.contenedor, sl);
      if (!validation.valid && validation.prefix) {
        throw new PrefixMismatchError(validation.prefix, args.naviera ?? null, validation.suggestions);
      }
      const { data, error } = await supabase.functions.invoke<SyncResponse>("jsoncargo-track", {
        body: { embarqueId: args.embarqueId },
      });
      if (error) throw error;
      return data!;
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: ["tracking_externo", "jsoncargo", args.embarqueId] });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.eventos(args.embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.detail(args.embarqueId) });
    },
  });
}

/**
 * Helper para extraer el summary actual del raw_payload guardado.
 * El edge function guarda { data: {...} } directamente desde JSONCargo.
 */
export function extractSummary(raw: unknown): JsonCargoSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const d = (raw as { data?: Record<string, unknown> }).data;
  if (!d) return null;
  return {
    container_status: d.container_status as string | undefined,
    last_location: d.last_location as string | undefined,
    current_vessel: d.current_vessel_name as string | undefined,
    current_voyage: d.current_voyage_number as string | undefined,
    eta_final_destination: d.eta_final_destination as string | undefined,
    shipped_from: d.shipped_from as string | undefined,
    shipped_to: d.shipped_to as string | undefined,
    last_updated: d.last_updated as string | undefined,
  };
}
