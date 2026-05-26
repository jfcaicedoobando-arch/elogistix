import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { mapNavieraToJsonCargo } from "@/lib/jsoncargo/navieras";
import { validatePrefixMatchesNaviera } from "@/lib/jsoncargo/containerPrefixes";
import { PrefixMismatchError, extractSummary } from "@/lib/jsoncargo/summary";
import type { JsonCargoSummary } from "@/lib/jsoncargo/summary";
import type { ApplyFechasArgs } from "@/services/embarque/jsoncargoFechas";
import {
  fetchJsonCargoTracking,
  invokeJsonCargoTrack,
  applyJsonCargoFechas,
  type TrackingExternoRow,
} from "@/services/embarque";

// Re-exports para compatibilidad con consumidores existentes.
export { PrefixMismatchError, extractSummary };
export type { JsonCargoSummary, TrackingExternoRow };

export function useJsonCargoTracking(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.jsonCargo.byEmbarque(embarqueId),
    queryFn: async (): Promise<TrackingExternoRow | null> => {
      if (!embarqueId) return null;
      return fetchJsonCargoTracking(embarqueId);
    },
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
}

export interface SyncArgs {
  embarqueId: string;
  contenedor?: string | null;
  naviera?: string | null;
}

export function useSyncJsonCargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: SyncArgs) => {
      const sl = mapNavieraToJsonCargo(args.naviera);
      const validation = validatePrefixMatchesNaviera(args.contenedor, sl);
      if (!validation.valid && validation.prefix) {
        throw new PrefixMismatchError(validation.prefix, args.naviera ?? null, validation.suggestions);
      }
      return invokeJsonCargoTrack(args.embarqueId);
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
    mutationFn: (args: ApplyFechasArgs) => applyJsonCargoFechas(args),
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.detail(args.embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.all });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.eventos(args.embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.full(args.embarqueId) });
    },
  });
}
