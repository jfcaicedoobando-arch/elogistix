/**
 * Captura y persiste parámetros UTM + referrer al aterrizar en la landing.
 * Se guardan en sessionStorage para adjuntarlos al lead cuando el visitante
 * pulsa "Probar demo". La utilidad pura `getAttribution` vive en
 * `../lib/attribution` para respetar la jerarquía Pages→Hooks→Services→Lib.
 */
import { useEffect } from "react";
import {
  ATTRIBUTION_STORAGE_KEY,
  type Attribution,
} from "@/features/marketing/lib/attribution";
import { safeSessionStorage } from "@/lib/browserStorage";

export function useCaptureUtmParams(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const existing = safeSessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
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
      safeSessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // sessionStorage puede fallar en modo privado; silencioso.
    }
  }, []);
}
