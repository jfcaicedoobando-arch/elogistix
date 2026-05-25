/**
 * Lógica pura para JSONCargo: extracción de summary y error de prefix.
 * Extraído de `hooks/embarque/useJsonCargoTracking.ts` (Power of 10: ≤200 LOC).
 */
import type { JsonCargoShippingLine } from "@/lib/jsoncargo/navieras";

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

/**
 * Helper para extraer el summary actual del raw_payload guardado.
 * El edge function guarda { data: {...} } directamente desde JSONCargo.
 */
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
