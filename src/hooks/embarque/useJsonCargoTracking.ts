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
type Raw = Record<string, unknown>;
const str = (d: Raw, k: string) => (d[k] as string | undefined | null) ?? undefined;
const lower = (s: string | undefined | null) => (s ?? "").toLowerCase();

function computeEtd(d: Raw): { effective?: string; estimated: boolean; atd?: string } {
  const atd = str(d, "atd_origin");
  const status = lower(str(d, "container_status"));
  const looksDeparted = /loaded.*vessel|on vessel|departed|in transit|sail/.test(status);
  const fallback = looksDeparted
    ? (str(d, "last_movement_timestamp") ?? str(d, "timestamp_of_last_location"))
    : undefined;
  const effective = atd || fallback || undefined;
  return { effective, estimated: !!effective && !atd, atd };
}

function computeAta(d: Raw): { effective?: string; inferred: boolean } {
  const status = lower(str(d, "container_status"));
  const lastLoc = lower(str(d, "last_location"));
  const dischPort = lower(str(d, "discharging_port"));
  const atDestinationByPort = !!lastLoc && !!dischPort && lastLoc.includes(dischPort);
  const looksDischarged = /discharg|unload|available|gate.?out|delivered|at yard|empty.*return|released|on rail|departed.*terminal/.test(status);
  const statusImpliesPortDischarge = /port of discharge|from vessel|at port|at terminal/.test(status);
  const eligible = (atDestinationByPort && looksDischarged) || (looksDischarged && statusImpliesPortDischarge);
  const effective = eligible
    ? (str(d, "timestamp_of_last_location") ?? str(d, "last_movement_timestamp"))
    : undefined;
  return { effective, inferred: !!effective };
}

export function extractSummary(raw: unknown): JsonCargoSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const d = (raw as { data?: Raw }).data;
  if (!d) return null;
  const etd = computeEtd(d);
  const ata = computeAta(d);
  return {
    container_status: str(d, "container_status"),
    last_location: str(d, "last_location"),
    current_vessel: str(d, "current_vessel_name"),
    current_voyage: str(d, "current_voyage_number"),
    eta_final_destination: str(d, "eta_final_destination"),
    atd_origin: etd.atd ?? undefined,
    etd_origin_effective: etd.effective,
    etd_origin_is_estimated: etd.estimated,
    ata_effective: ata.effective,
    ata_is_inferred: ata.inferred,
    shipped_from: str(d, "shipped_from"),
    shipped_to: str(d, "shipped_to"),
    last_updated: str(d, "last_updated"),
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
      const update: { eta?: string; etd?: string; fecha_llegada_real?: string; estado?: "Arribo" } = {};
      if (eta) update.eta = eta;
      if (etd) update.etd = etd;
      if (ata) {
        update.fecha_llegada_real = ata;
        // Si el contenedor ya arribó (ATA conocida) y no recibimos un ETA
        // distinto explícito, alineamos el ETA a la fecha real de llegada
        // para que el resumen refleje la realidad operativa.
        if (!eta) update.eta = ata;
      }
      if (Object.keys(update).length === 0) return { applied: false };

      // Si se está aplicando ATA, avanzar el estado a "Arribo" automáticamente
      // siempre que el embarque siga en una etapa previa (no retroceder).
      let avanzaArribo = false;
      if (ata) {
        const { data: emb, error: errEmb } = await supabase
          .from("embarques")
          .select("estado")
          .eq("id", embarqueId)
          .maybeSingle();
        if (errEmb) throw errEmb;
        const estadoActual = (emb?.estado as string | undefined) ?? "";
        if (estadoActual === "Confirmado" || estadoActual === "En Tránsito") {
          update.estado = "Arribo";
          avanzaArribo = true;
        }
      }

      const { data, error } = await supabase
        .from("embarques")
        .update(update)
        .eq("id", embarqueId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("No se pudo actualizar el embarque. Verifica permisos o que el registro exista.");
      }

      // Registrar evento de tracking "Arribo a Puerto" si avanzamos el estado,
      // evitando duplicados para la misma fecha.
      if (avanzaArribo && ata) {
        const { data: existentes } = await supabase
          .from("eventos_embarque")
          .select("id, fecha")
          .eq("embarque_id", embarqueId)
          .eq("tipo", "Arribo a Puerto");
        const yaExiste = (existentes ?? []).some((e: { fecha: string }) =>
          (e.fecha ?? "").slice(0, 10) === ata,
        );
        if (!yaExiste) {
          const { data: userData } = await supabase.auth.getUser();
          const usuario = userData?.user?.email ?? "Sistema";
          await supabase.from("eventos_embarque").insert({
            embarque_id: embarqueId,
            tipo: "Arribo a Puerto",
            descripcion: 'Estado cambiado a "Arribo" (arribo real registrado)',
            ubicacion: "",
            fecha: `${ata}T00:00:00Z`,
            usuario,
          });
        }
      }

      return { applied: true, avanzaArribo };
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.detail(args.embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.all });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.eventos(args.embarqueId) });
      // Invalida la caché unificada del detalle (RPC get_embarque_full)
      // para que el tab Resumen se refresque sin recargar la página.
      qc.invalidateQueries({ queryKey: [...queryKeys.embarques.all, "full", args.embarqueId] });
    },
  });
}
