/**
 * Utilidades puras de atribución (UTM + referrer + landing path).
 * Sin dependencias de React. El hook `useCaptureUtmParams` vive en
 * `../hooks/useUtmParams` y utiliza estas funciones/constantes.
 */

import { safeSessionStorage, STORAGE_KEYS } from "@/lib/browserStorage";

/** Ola 9 · B6: la llave vive en el catálogo central `STORAGE_KEYS`. */
export const ATTRIBUTION_STORAGE_KEY = STORAGE_KEYS.marketingAttribution;


export interface Attribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_path: string | null;
}

export const EMPTY_ATTRIBUTION: Attribution = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  referrer: null,
  landing_path: null,
};

const KEYS: (keyof Attribution)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "landing_path",
];

export function getAttribution(): Attribution {
  try {
    const raw = safeSessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return EMPTY_ATTRIBUTION;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY_ATTRIBUTION;
    const rec = parsed as Record<string, unknown>; // SAFE-CAST: narrowed above via typeof/object check
    const out: Attribution = { ...EMPTY_ATTRIBUTION };
    for (const k of KEYS) {
      const v = rec[k];
      out[k] = typeof v === "string" ? v : null;
    }
    return out;
  } catch {
    return EMPTY_ATTRIBUTION;
  }
}
