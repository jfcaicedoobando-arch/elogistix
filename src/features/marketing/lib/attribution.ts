/**
 * Utilidades puras de atribución (UTM + referrer + landing path).
 * Sin dependencias de React. El hook `useCaptureUtmParams` vive en
 * `../hooks/useUtmParams` y utiliza este tipo y la llave de almacenamiento.
 */

import { STORAGE_KEYS } from "@/lib/browserStorage";

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
