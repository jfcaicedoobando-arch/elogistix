/**
 * Catálogo de URLs de tracking público para navieras NO soportadas por JSONCargo.
 * Permite ofrecer al usuario un link directo al sitio oficial de la naviera para
 * consultar manualmente con el contenedor o BL.
 */

export interface ExternalTrackingLink {
  label: string;
  url: string;
  /** true si es un fallback genérico (track-trace.com) y no la web oficial. */
  generic?: boolean;
}

type Builder = (container: string | null, bl: string | null) => string;

interface Carrier {
  /** Nombre legible para mostrar al usuario. */
  label: string;
  /** Construye la URL priorizando contenedor; si no hay contenedor cae al BL. */
  build: Builder;
}

/** key normalizado (lowercase, sin separadores) → carrier */
const CARRIERS: Record<string, Carrier> = {
  whlc: {
    label: "Wan Hai Lines",
    build: () => `https://www.wanhai.com/views/cargo_track_v2/tracking_query.xhtml`,
  },
  wanhai: {
    label: "Wan Hai Lines",
    build: () => `https://www.wanhai.com/views/cargo_track_v2/tracking_query.xhtml`,
  },
  anl: {
    label: "ANL (CMA CGM)",
    build: (c, b) =>
      `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference=${encodeURIComponent(c ?? b ?? "")}`,
  },
  sitc: {
    label: "SITC",
    build: (c, b) =>
      `https://api.sitcline.com/sitcline-track/track?blNo=${encodeURIComponent(b ?? c ?? "")}`,
  },
  heunga: {
    label: "Heung-A Line",
    build: (c, b) =>
      `https://ekmtc.com/index.html#/cargo-tracking?blNo=${encodeURIComponent(b ?? c ?? "")}`,
  },
  panocean: {
    label: "Pan Ocean",
    build: (c, b) =>
      `https://www.panocean.com/CargoTracking/CargoTrackingList?searchType=BL&searchKeyword=${encodeURIComponent(b ?? c ?? "")}`,
  },
  sinokor: {
    label: "Sinokor Merchant Marine",
    build: (c, b) =>
      `https://www.sinokor.co.kr/m41Tracking/index.do?blNo=${encodeURIComponent(b ?? c ?? "")}`,
  },
  tslines: {
    label: "T.S. Lines",
    build: (c, b) =>
      `https://www.tslines.com/Service/Cargo_Tracking?bl=${encodeURIComponent(b ?? c ?? "")}`,
  },
  ts: {
    label: "T.S. Lines",
    build: (c, b) =>
      `https://www.tslines.com/Service/Cargo_Tracking?bl=${encodeURIComponent(b ?? c ?? "")}`,
  },
  kmtc: {
    label: "KMTC Line",
    build: (c, b) =>
      `https://www.kmtc.co.kr/service/tracking/cargo.do?blNo=${encodeURIComponent(b ?? c ?? "")}`,
  },
};

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Devuelve un link de tracking externo para la naviera dada.
 * - Si la naviera tiene URL oficial conocida, devuelve esa.
 * - Si no, pero hay contenedor, devuelve fallback genérico (track-trace.com).
 * - Si no hay nada útil, devuelve null.
 */
export function getExternalTracking(
  naviera: string | null | undefined,
  contenedor: string | null | undefined,
  blMaster: string | null | undefined,
): ExternalTrackingLink | null {
  const c = contenedor?.trim() || null;
  const b = blMaster?.trim() || null;

  if (naviera) {
    const key = normalize(naviera);
    // Match exacto o por inclusión (ej. "WHLC - Wan Hai" contiene "whlc")
    const carrier =
      CARRIERS[key] ??
      Object.entries(CARRIERS).find(([k]) => key.includes(k))?.[1];
    if (carrier && (c || b)) {
      return { label: `Abrir tracking en ${carrier.label}`, url: carrier.build(c, b) };
    }
  }

  if (c) {
    return {
      label: "Buscar en Track-Trace",
      url: `https://www.track-trace.com/container/${encodeURIComponent(c)}`,
      generic: true,
    };
  }

  return null;
}
