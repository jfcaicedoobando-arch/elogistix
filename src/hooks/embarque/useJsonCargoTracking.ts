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
  /** ETD efectivo: usa atd_origin o, si null y el contenedor ya zarpó, last_movement_timestamp. */
  etd_origin_effective?: string;
  /** True si etd_origin_effective viene del fallback (no del campo atd_origin de JSONCargo). */
  etd_origin_is_estimated?: boolean;
  /** ATA efectiva inferida desde último movimiento si el contenedor ya está en puerto destino. */
  ata_effective?: string;
  /** True si la ATA viene inferida del último movimiento. */
  ata_is_inferred?: boolean;
  shipped_from?: string;
  shipped_to?: string;
  last_updated?: string;
  eta_propuesta?: string | null;
  etd_propuesta?: string | null;
  ata_propuesta?: string | null;
  eta_actual?: string | null;
  etd_actual?: string | null;
  ata_actual?: string | null;
  eta_difiere?: boolean;
  etd_difiere?: boolean;
  ata_difiere?: boolean;
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
  const atdOrigin = d.atd_origin as string | undefined | null;
  const status = ((d.container_status as string | undefined) ?? "").toLowerCase();
  const looksDeparted = /loaded.*vessel|on vessel|departed|in transit|sail/.test(status);
  const fallbackEtd = looksDeparted
    ? ((d.last_movement_timestamp as string | undefined | null)
      ?? (d.timestamp_of_last_location as string | undefined | null))
    : null;
  const etdEffective = atdOrigin || fallbackEtd || undefined;

  // Heurística ATA: contenedor ya descargado/disponible en puerto destino.
  const lastLoc = ((d.last_location as string | undefined) ?? "").toLowerCase();
  const dischPort = ((d.discharging_port as string | undefined) ?? "").toLowerCase();
  const atDestinationByPort = !!lastLoc && !!dischPort && lastLoc.includes(dischPort);
  const looksDischarged = /discharg|unload|available|gate.?out|delivered|at yard|empty.*return|released|on rail|departed.*terminal/.test(status);
  // Fallback: si discharging_port viene vacío pero el container_status
  // menciona explícitamente "port of discharge" / "from vessel" / "at port",
  // también se infiere ATA desde el último movimiento.
  const statusImpliesPortDischarge = /port of discharge|from vessel|at port|at terminal/.test(status);
  const ataEligible = (atDestinationByPort && looksDischarged) || (looksDischarged && statusImpliesPortDischarge);
  const ataEffective = ataEligible
    ? ((d.timestamp_of_last_location as string | undefined | null)
      ?? (d.last_movement_timestamp as string | undefined | null))
    : null;

  return {
    container_status: d.container_status as string | undefined,
    last_location: d.last_location as string | undefined,
    current_vessel: d.current_vessel_name as string | undefined,
    current_voyage: d.current_voyage_number as string | undefined,
    eta_final_destination: d.eta_final_destination as string | undefined,
    atd_origin: atdOrigin ?? undefined,
    etd_origin_effective: etdEffective ?? undefined,
    etd_origin_is_estimated: !!etdEffective && !atdOrigin,
    ata_effective: ataEffective ?? undefined,
    ata_is_inferred: !!ataEffective,
    shipped_from: d.shipped_from as string | undefined,
    shipped_to: d.shipped_to as string | undefined,
    last_updated: d.last_updated as string | undefined,
  };
}

interface ApplyFechasArgs {
  embarqueId: string;
  eta?: string | null;
  etd?: string | null;
  ata?: string | null;
}

export function useApplyJsonCargoFechas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, eta, etd, ata }: ApplyFechasArgs) => {
      const update: { eta?: string; etd?: string; fecha_llegada_real?: string } = {};
      if (eta) update.eta = eta;
      if (etd) update.etd = etd;
      if (ata) update.fecha_llegada_real = ata;
      if (Object.keys(update).length === 0) return { applied: false };
      const { error } = await supabase.from("embarques").update(update).eq("id", embarqueId);
      if (error) throw error;
      return { applied: true };
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.detail(args.embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.all });
    },
  });
}
