/**
 * Captura y persiste parámetros UTM + referrer al aterrizar en la landing.
 * Se guardan en sessionStorage para adjuntarlos al lead cuando el visitante
 * pulsa "Probar demo".
 */
import { useEffect } from "react";

const STORAGE_KEY = "librecarga_attribution_v1";

export interface Attribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_path: string | null;
}

const EMPTY: Attribution = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  referrer: null,
  landing_path: null,
};

export function useCaptureUtmParams(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const existing = window.sessionStorage.getItem(STORAGE_KEY);
      if (existing) return;
      const params = new URLSearchParams(window.location.search);
      const data: Attribution = {
        utm_source: params.get("utm_source"),
        utm_medium: params.get("utm_medium"),
        utm_campaign: params.get("utm_campaign"),
        utm_content: params.get("utm_content"),
        utm_term: params.get("utm_term"),
        referrer: document.referrer || null,
        landing_path: window.location.pathname + window.location.search,
      };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // sessionStorage puede fallar en modo privado; silencioso.
    }
  }, []);
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Attribution>) };
  } catch {
    return EMPTY;
  }
}
