/**
 * Constantes y helpers puros extraídos de `core.ts` para respetar el límite
 * Power-of-10 de 200 líneas. No inicializa Sentry — sólo expone valores
 * inmutables y funciones sin side-effects que consume `initSentry()`.
 */
import { scrubPii, scrubUrl, isSensitiveApiUrl } from "@/lib/observability/piiScrub";

/** Lee un sample rate opcional de env, clamp a [0,1]. */
export function readRate(key: string, fallback: number): number {
  const raw = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/** Hosts a los que adjuntar `sentry-trace` / `baggage` para trazas distribuidas
 *  front ↔ edge functions. Incluye el proyecto Supabase y dominios productivos. */
export const TRACE_PROPAGATION_TARGETS: Array<string | RegExp> = [
  /^\/(api|functions)\//,
  /\.supabase\.co\/functions\/v1\//,
  /librecarga\.com/,
];

// 13.312.10 (audit Sentry PR-C): orígenes de código ajeno a la app que jamás
// deben producir eventos. Extensiones del navegador y scripts de terceros
// inyectados por hosting / analytics generan errores que no podemos corregir.
export const DENY_URLS: Array<string | RegExp> = [
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-(web-)?extension:\/\//i,
  /extensions\//i,
  /\/gtag\/js/i,
  /googletagmanager\.com/i,
  /\/flock\.js/i,
];

// Patrones de mensajes de error que jamás queremos reportar.
export const IGNORE_ERRORS: Array<string | RegExp> = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Loading chunk \d+ failed/i,
  /ChunkLoadError/i,
  /Should have a queue\. This is likely a bug in React/i,
  /Invalid Refresh Token: Refresh Token Not Found/i,
  /AbortError: Lock broken by another request/i,
  /Lock broken by another request with the 'steal' option/i,
  /Invalid login credentials/i,
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i,
  /Non-Error promise rejection captured/i,
  /Object Not Found Matching Id/i,
  /^Load failed$/i,
  /NetworkError when attempting to fetch resource/i,
  /Extension context invalidated/i,
  /The operation was aborted/i,
];

/** 13.312.10: URL del túnel Sentry sólo si tenemos base de Supabase configurada. */
export function resolveTunnelUrl(): string | undefined {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base || typeof base !== "string") return undefined;
  return `${base.replace(/\/$/, "")}/functions/v1/sentry-tunnel`;
}

/** Scrub PII en breadcrumbs (console/fetch/xhr) antes de que Sentry los envíe. */
export function scrubBreadcrumb<T extends {
  category?: string;
  level?: string;
  message?: unknown;
  data?: Record<string, unknown>;
}>(breadcrumb: T): T | null {
  if (breadcrumb.category === "console" && breadcrumb.level === "log") return null;
  if ((breadcrumb.category === "fetch" || breadcrumb.category === "xhr") && breadcrumb.data) {
    const url = breadcrumb.data.url as string | undefined;
    if (isSensitiveApiUrl(url)) {
      delete breadcrumb.data.request_body;
      delete breadcrumb.data.response_body;
    }
    if (typeof url === "string") {
      breadcrumb.data.url = scrubUrl(url);
    }
  }
  if (typeof breadcrumb.message === "string") {
    breadcrumb.message = scrubPii(breadcrumb.message);
  }
  return breadcrumb;
}
