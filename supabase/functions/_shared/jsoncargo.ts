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
  eglv: "EVERGREEN",
  msc: "MSC",
  mediterranean: "MSC",
  cmacgm: "CMA_CGM",
  cma: "CMA_CGM",
  cosco: "COSCO",
  oocl: "COSCO",
  oolu: "COSCO",
  oocu: "COSCO",
  orientoverseas: "COSCO",
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

/**
 * Catálogo de prefixes BIC conocidos por naviera (subset usado en validación
 * server-side antes de gastar cuota de la API). Mantener sincronizado con
 * src/lib/jsoncargo/containerPrefixes.ts.
 */
const ALL_SUPPORTED = [
  "MAERSK", "HAPAG_LLOYD", "HMM", "ONE", "EVERGREEN", "MSC",
  "CMA_CGM", "COSCO", "ZIM", "YANG_MING", "PIL",
];

const PREFIX_TO_CARRIERS: Record<string, string[]> = {
  MAEU: ["MAERSK"], MRKU: ["MAERSK"], MSKU: ["MAERSK"], MRSU: ["MAERSK"],
  MIEU: ["MAERSK"], MNBU: ["MAERSK"], PONU: ["MAERSK"], SEAU: ["MAERSK"],
  MSCU: ["MSC"], MEDU: ["MSC"], MSDU: ["MSC"], MSWU: ["MSC"], FCIU: ["MSC"],
  HLXU: ["HAPAG_LLOYD"], HLBU: ["HAPAG_LLOYD"], HLCU: ["HAPAG_LLOYD"],
  UACU: ["HAPAG_LLOYD"], CAIU: ["HAPAG_LLOYD"],
  CMAU: ["CMA_CGM"], CGMU: ["CMA_CGM"], CXDU: ["CMA_CGM"], ECMU: ["CMA_CGM"],
  APHU: ["CMA_CGM"], APZU: ["CMA_CGM"], CXRU: ["CMA_CGM"],
  COSU: ["COSCO"], CCLU: ["COSCO"], CBHU: ["COSCO"], CSNU: ["COSCO"],
  CSLU: ["COSCO"], OOLU: ["COSCO"], OOCU: ["COSCO"],
  EGHU: ["EVERGREEN"], EISU: ["EVERGREEN"], EITU: ["EVERGREEN"],
  EMCU: ["EVERGREEN"], HMCU: ["EVERGREEN"], EGSU: ["EVERGREEN"],
  ZIMU: ["ZIM"], ZCSU: ["ZIM"],
  YMLU: ["YANG_MING"], YMMU: ["YANG_MING"], YMUU: ["YANG_MING"],
  ONEU: ["ONE"], KKFU: ["ONE"], KKTU: ["ONE"],
  HMMU: ["HMM"], HDMU: ["HMM"],
  PCIU: ["PIL"], PILU: ["PIL"],
  // Leasing pools — cualquier naviera grande puede usar estos contenedores
  TEMU: ALL_SUPPORTED, TCLU: ALL_SUPPORTED, TCNU: ALL_SUPPORTED,
  TGBU: ALL_SUPPORTED, TGCU: ALL_SUPPORTED, TGHU: ALL_SUPPORTED,
  TRHU: ALL_SUPPORTED, TRIU: ALL_SUPPORTED, TLLU: ALL_SUPPORTED,
  BEAU: ALL_SUPPORTED, BMOU: ALL_SUPPORTED,
  GLDU: ALL_SUPPORTED, GESU: ALL_SUPPORTED,
  SEGU: ALL_SUPPORTED, UESU: ALL_SUPPORTED,
  CAXU: ALL_SUPPORTED, CRXU: ALL_SUPPORTED, WHLU: ALL_SUPPORTED,
};

export function extractPrefix(container: string | null | undefined): string | null {
  if (!container) return null;
  const m = container.trim().toUpperCase().match(/^[A-Z]{4}/);
  return m ? m[0] : null;
}

export interface PrefixCheck {
  valid: boolean;
  prefix: string | null;
  suggestions: string[];
  known: boolean;
}

export function checkPrefixVsCarrier(container: string | null | undefined, shippingLine: string | null): PrefixCheck {
  const prefix = extractPrefix(container);
  if (!prefix) return { valid: true, prefix: null, suggestions: [], known: false };
  const carriers = PREFIX_TO_CARRIERS[prefix];
  if (!carriers || carriers.length === 0) return { valid: true, prefix, suggestions: [], known: false };
  if (shippingLine && carriers.includes(shippingLine)) return { valid: true, prefix, suggestions: [], known: true };
  return { valid: false, prefix, suggestions: carriers, known: true };
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

export interface JsonCargoBolData {
  bill_of_lading: string;
  shipping_line_name: string;
  shipping_line_id: string;
  associated_containers: number;
  associated_container_numbers: string[];
  last_updated: string;
}

export interface JsonCargoBolResult {
  ok: boolean;
  status: number;
  data?: JsonCargoBolData;
  errorTitle?: string;
  raw?: unknown;
}

export async function fetchBolContainers(
  apiKey: string,
  blNumber: string,
  shippingLine: string,
): Promise<JsonCargoBolResult> {
  const url = `${JSONCARGO_BASE}/containers/bol/${encodeURIComponent(blNumber)}?shipping_line=${shippingLine}`;
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  let body: { data?: JsonCargoBolData; error?: { title?: string } } = {};
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

/**
 * Devuelve la mejor fecha disponible para el ETD/zarpe.
 * Si `atd_origin` viene null pero el contenedor ya está cargado/zarpado,
 * usa `last_movement_timestamp` (o `timestamp_of_last_location`) como fallback.
 */
export function pickEffectiveEtd(d: JsonCargoContainerData): string | null {
  if (d.atd_origin) return d.atd_origin;
  const status = (d.container_status ?? "").toLowerCase();
  const looksDeparted = /loaded.*vessel|on vessel|departed|in transit|sail/.test(status);
  if (looksDeparted) {
    return d.last_movement_timestamp ?? d.timestamp_of_last_location ?? null;
  }
  return null;
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
