// Lógica compartida entre jsoncargo-track (call manual con JWT)
// y jsoncargo-track-batch (cron con service role).
// Reusa Deno fetch directo a la API JSONCargo.

const JSONCARGO_BASE = "https://api.jsoncargo.com/api/v1";

const NAVIERA_MAP: Record<string, string> = {
  maersk: "MAERSK",
  hapag: "HAPAG_LLOYD",
  lloyd: "HAPAG_LLOYD",
  hmm: "HMM",
  hyundai: "HMM",
  one: "ONE",
  oceannetwork: "ONE",
  evergreen: "EVERGREEN",
  msc: "MSC",
  mediterranean: "MSC",
  cmacgm: "CMA_CGM",
  cma: "CMA_CGM",
  cosco: "COSCO",
  zim: "ZIM",
  yangming: "YANG_MING",
  yang: "YANG_MING",
  pil: "PIL",
};

export function mapNaviera(naviera: string | null | undefined): string | null {
  if (!naviera) return null;
  const n = naviera.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [key, value] of Object.entries(NAVIERA_MAP)) {
    if (n.includes(key)) return value;
  }
  return null;
}

export interface JsonCargoContainerData {
  container_id: string;
  container_status: string;
  shipping_line_name: string;
  shipping_line_id: string;
  shipped_from: string;
  shipped_to: string;
  atd_origin: string | null;
  eta_final_destination: string | null;
  last_location: string;
  next_location: string;
  atd_last_location: string | null;
  eta_next_destination: string | null;
  timestamp_of_last_location: string | null;
  last_movement_timestamp: string | null;
  loading_port: string;
  discharging_port: string;
  customs_clearance: string | null;
  bill_of_lading: string;
  current_vessel_name: string;
  current_voyage_number: string;
  last_vessel_name: string;
  last_voyage_number: string;
  last_updated: string;
}

export interface JsonCargoCallResult {
  ok: boolean;
  status: number;
  data?: JsonCargoContainerData;
  errorTitle?: string;
  raw?: unknown;
}

export async function fetchContainerDetails(
  apiKey: string,
  containerNumber: string,
  shippingLine: string,
): Promise<JsonCargoCallResult> {
  const url = `${JSONCARGO_BASE}/containers/${encodeURIComponent(containerNumber)}?shipping_line=${shippingLine}`;
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  let body: { data?: JsonCargoContainerData; error?: { title?: string } } = {};
  try {
    body = await res.json();
  } catch {
    return { ok: false, status: res.status, errorTitle: `HTTP ${res.status}` };
  }
  if (!res.ok || !body?.data) {
    return { ok: false, status: res.status, errorTitle: body?.error?.title ?? `HTTP ${res.status}`, raw: body };
  }
  return { ok: true, status: 200, data: body.data, raw: body };
}

/**
 * Convierte un timestamp tipo "2024-09-09 18:34" o "2024-08-10 00:00" a ISO con zona UTC.
 * Si no se puede parsear, devuelve null.
 */
export function parseJsonCargoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;
  // Espera "YYYY-MM-DD HH:MM" o "YYYY-MM-DDTHH:MM:SS..."
  const isoCandidate = s.includes("T") ? s : s.replace(" ", "T") + ":00Z";
  const d = new Date(isoCandidate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export interface ComputedEvent {
  tipo: string; // tipo_evento_tracking enum value
  descripcion: string;
  ubicacion: string;
  fecha: string; // ISO
}

/**
 * Deriva los eventos clave de tracking desde la respuesta JSONCargo.
 * Evita generar eventos sin fecha.
 */
export function deriveEventsFromContainer(data: JsonCargoContainerData): ComputedEvent[] {
  const out: ComputedEvent[] = [];
  const zarpe = parseJsonCargoDate(data.atd_origin);
  if (zarpe) {
    out.push({
      tipo: "Zarpe",
      descripcion: `Zarpe desde ${data.shipped_from || data.loading_port || "origen"}${data.last_vessel_name ? ` en ${data.last_vessel_name} ${data.last_voyage_number ?? ""}`.trim() : ""}`,
      ubicacion: data.shipped_from || data.loading_port || "",
      fecha: zarpe,
    });
  }

  const ultimaUbic = parseJsonCargoDate(data.timestamp_of_last_location);
  const lastLoc = data.last_location || "";
  const isAtDestination = lastLoc && data.discharging_port && lastLoc.toLowerCase().includes(data.discharging_port.toLowerCase());
  if (ultimaUbic && lastLoc) {
    out.push({
      tipo: isAtDestination ? "Arribo a Puerto" : "Transbordo",
      descripcion: `${isAtDestination ? "Arribo" : "Movimiento"} en ${lastLoc}${data.current_vessel_name ? ` (${data.current_vessel_name})` : ""}. Estado: ${data.container_status || "—"}`,
      ubicacion: lastLoc,
      fecha: ultimaUbic,
    });
  }

  const aduana = parseJsonCargoDate(data.customs_clearance);
  if (aduana) {
    out.push({
      tipo: "Despacho Aduanal",
      descripcion: `Despacho aduanal completado en ${data.discharging_port || data.last_location || "destino"}`,
      ubicacion: data.discharging_port || data.last_location || "",
      fecha: aduana,
    });
  }

  return out;
}
