import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query";
import { mapNavieraToJsonCargo } from "@/lib/jsoncargo/navieras";
import { validatePrefixMatchesNaviera } from "@/lib/jsoncargo/containerPrefixes";
import { PrefixMismatchError, extractSummary } from "@/lib/jsoncargo/summary";
import type { JsonCargoSummary } from "@/lib/jsoncargo/summary";
import {
  buildFechasUpdate,
  shouldAvanzarArribo,
  registrarEventoArribo,
  type ApplyFechasArgs,
} from "@/services/embarque/jsoncargoFechas";

// Re-exports para compatibilidad con consumidores existentes.
export { PrefixMismatchError, extractSummary };
export type { JsonCargoSummary };

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
      qc.invalidateQueries({ queryKey: queryKeys.jsonCargo.byEmbarque(args.embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.eventos(args.embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.detail(args.embarqueId) });
    },
  });
}

export function useApplyJsonCargoFechas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, eta, etd, ata }: ApplyFechasArgs) => {
      const update = buildFechasUpdate({ eta, etd, ata });
      if (Object.keys(update).length === 0) return { applied: false };

      const avanzaArribo = await shouldAvanzarArribo(embarqueId, ata);
      if (avanzaArribo) update.estado = "Arribo";

      const { data, error } = await supabase
        .from("embarques").update(update).eq("id", embarqueId).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("No se pudo actualizar el embarque. Verifica permisos o que el registro exista.");
      }

      if (avanzaArribo && ata) await registrarEventoArribo(embarqueId, ata);
      return { applied: true, avanzaArribo };
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.detail(args.embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.all });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.eventos(args.embarqueId) });
      qc.invalidateQueries({ queryKey: [...queryKeys.embarques.all, "full", args.embarqueId] });
    },
  });
}
