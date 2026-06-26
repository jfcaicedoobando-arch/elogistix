/**
 * Inicialización de Sentry (errores + feedback widget + screenshots).
 * El DSN es público — Sentry está diseñado para que viva en el bundle del front.
 *
 * IMPORTANTE: este módulo se importa de forma DINÁMICA desde main.tsx
 * (dentro de requestIdleCallback) para que `@sentry/react` y todas sus
 * integraciones queden en `sentry-vendor` y NO en el chunk crítico.
 *
 * El widget se dispara manualmente desde FeedbackButton.tsx con
 * `Sentry.getFeedback()?.createForm()`. autoInject: false evita el botón
 * flotante por defecto.
 */
import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { APP_VERSION } from "@/constants/appVersion";
import { isDynamicImportErrorMessage } from "@/lib/errors/dynamicImportError";
import { scrubPii, scrubUrl, isSensitiveApiUrl } from "@/lib/observability/piiScrub";
import {
  isReactRefreshHmrError,
  isReactRefreshStackTrace,
  sampleByRoute,
  scrubEventPii,
} from "./helpers";
import { FEEDBACK_INTEGRATION_OPTIONS } from "./feedbackConfig";

export {
  isReactRefreshHmrError,
  isReactRefreshStackTrace,
  sampleByRoute,
  scrubEventPii,
} from "./helpers";

// DSN del proyecto elogistix/javascript-react (clave pública, segura en bundle).
const DEFAULT_DSN =
  "https://e44f92892772533298354b89d9ef3ddb@o4511415732404224.ingest.us.sentry.io/4511415734108160";
const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || DEFAULT_DSN;

/** Hosts a los que adjuntar `sentry-trace` / `baggage` para trazas distribuidas
 *  front ↔ edge functions. Incluye el proyecto Supabase y dominios productivos. */
const TRACE_PROPAGATION_TARGETS: Array<string | RegExp> = [
  /^\/(api|functions)\//,
  /\.supabase\.co\/functions\/v1\//,
  /librecarga\.com/,
];

/** Detecta errores de chunk/HMR que se auto-recuperan con reload. */
function isRecoverableLoadError(
  event: Sentry.ErrorEvent,
  exc: Error | undefined,
  originalMsg: string | undefined,
): boolean {
  if (isDynamicImportErrorMessage(originalMsg)) return true;
  if (isDynamicImportErrorMessage(event.message)) return true;
  const values = event.exception?.values;
  if (values?.some((v) => isDynamicImportErrorMessage(v.value))) return true;
  if (exc && isReactRefreshHmrError(exc)) return true;
  if (values?.some((v) => isReactRefreshStackTrace(v.stacktrace))) return true;
  return false;
}

/** Errores de validación (zod) son input del usuario, no bugs. */
function isZodValidationError(exc: Error | undefined): boolean {
  const cause = (exc as (Error & { cause?: unknown }) | undefined)?.cause;
  const causeName = (cause as { name?: string } | undefined)?.name;
  const excName = (exc as { name?: string } | undefined)?.name;
  return causeName === "ZodError" || excName === "ZodError";
}

/**
 * Predicado para `beforeSend`: decide si un evento debe descartarse antes de
 * llegar a Sentry. Extraído para mantener el `beforeSend` con complejidad baja.
 */
function shouldDropSentryEvent(
  event: Sentry.ErrorEvent,
  hint: Sentry.EventHint | undefined,
): boolean {
  const exc = hint?.originalException as Error | undefined;
  const originalMsg =
    exc?.message ??
    (typeof hint?.originalException === "string" ? hint.originalException : undefined);
  if (isRecoverableLoadError(event, exc, originalMsg)) return true;
  if (isZodValidationError(exc)) return true;
  return false;
}

/** Resuelve el environment de Sentry. Prioriza `VITE_SENTRY_ENV` (permite
 *  distinguir `preview` de `production` en builds idénticos). Fallback a MODE. */
function resolveEnvironment(): string {
  const explicit = import.meta.env.VITE_SENTRY_ENV as string | undefined;
  if (explicit && explicit.length > 0) return explicit;
  if (typeof window !== "undefined") {
    const host = window.location?.hostname ?? "";
    if (host.endsWith("lovable.app")) return "preview";
    if (host === "librecarga.com" || host === "www.librecarga.com") return "production";
  }
  return import.meta.env.MODE;
}

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (!DSN) return;
  // No inicializar en desarrollo: las sesiones locales generan ruido por HMR.
  if (import.meta.env.MODE === "development") return;
  initialized = true;
  // 13.114.17: warn si se está usando el DSN hardcodeado en producción real
  // (no preview). Permite detectar configuración faltante sin romper.
  if (!import.meta.env.VITE_SENTRY_DSN && resolveEnvironment() === "production") {
     
    console.warn("[sentry] VITE_SENTRY_DSN no configurado, usando DEFAULT_DSN hardcodeado");
  }
  // 13.114.17: `dist` para distinguir builds de la misma versión semver
  // (hotfixes rápidos). Usa VITE_BUILD_HASH si está disponible.
  const buildHash = (import.meta.env.VITE_BUILD_HASH as string | undefined) ?? undefined;
  // 13.114.17: tag PWA — segmenta errores que sólo ocurren con la app instalada.
  const isPwa =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  Sentry.init({
    dsn: DSN,
    release: `libre-carga@${APP_VERSION}`,
    dist: buildHash,
    environment: resolveEnvironment(),
    tracesSampler: sampleByRoute,
    tracePropagationTargets: TRACE_PROPAGATION_TARGETS,
    profilesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    tunnel: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sentry-tunnel`,


    // Defensa en profundidad: estos errores de Vite (chunk viejo cacheado)
    // se auto-recuperan con reload y no aportan señal.
    ignoreErrors: [
      /Failed to fetch dynamically imported module/i,
      /Importing a module script failed/i,
      /error loading dynamically imported module/i,
      /Loading chunk \d+ failed/i,
      /ChunkLoadError/i,
      /Should have a queue\. This is likely a bug in React/i,
      /Invalid Refresh Token: Refresh Token Not Found/i,
      // Web Locks API del cliente Supabase entre pestañas — ruido conocido.
      /AbortError: Lock broken by another request/i,
      /Lock broken by another request with the 'steal' option/i,
    ],
    beforeSend(event, hint) {
      if (shouldDropSentryEvent(event, hint)) return null;
      return scrubEventPii(event);
    },
    // 13.114.19: las transactions también pueden traer PII en `request.url`
    // (query strings con `?email=`, `?rfc=`, etc.) y en breadcrumbs de
    // navegación. `beforeSend` sólo se ejecuta para ErrorEvent — reutilizamos
    // `scrubEventPii` para cerrar la fuga en eventos de tipo transaction.
    beforeSendTransaction(event) {
      // SAFE-CAST: TransactionEvent y ErrorEvent comparten la forma scrubbeable
      // (request, breadcrumbs, user). `scrubEventPii` sólo lee/escribe campos
      // comunes; el doble cast evita duplicar la lógica de redacción.
      return scrubEventPii(event as unknown as Sentry.ErrorEvent) as unknown as typeof event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "console" && breadcrumb.level === "log") return null;
      if ((breadcrumb.category === "fetch" || breadcrumb.category === "xhr") && breadcrumb.data) {
        const url = breadcrumb.data.url as string | undefined;
        if (isSensitiveApiUrl(url)) {
          delete (breadcrumb.data as Record<string, unknown>).request_body;
          delete (breadcrumb.data as Record<string, unknown>).response_body;
        }
        if (typeof url === "string") {
          breadcrumb.data.url = scrubUrl(url);
        }
      }
      if (typeof breadcrumb.message === "string") {
        breadcrumb.message = scrubPii(breadcrumb.message);
      }
      return breadcrumb;
    },
    // 13.65.0: `autoSessionTracking` es el default del SDK; documentado en
    // comentario para que un futuro upgrade no regrese silenciosamente.
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.browserProfilingIntegration(),
      // F2 (13.65.0): captura automática de respuestas 5xx en fetch/XHR.
      // Empezamos en 500-599 para no inflar la cuota: muchos 4xx son
      // comportamiento esperado (401 al cargar sesión, 409 conflictos UX).
      // `failedRequestTargets` limita a nuestros backends — evita ruido de
      // CDNs/anuncios/extensiones de terceros.
      Sentry.httpClientIntegration({
        failedRequestStatusCodes: [[500, 599]],
        failedRequestTargets: [
          /\.supabase\.co\//,
          /librecarga\.com/,
          /^\/(api|functions)\//,
        ],
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
      Sentry.feedbackIntegration(FEEDBACK_INTEGRATION_OPTIONS),
    ],
  });
  Sentry.setTag("is_pwa", isPwa ? "true" : "false");
}


/** True una vez `initSentry()` se ha invocado al menos una vez. */
export function isSentryReady(): boolean {
  return initialized;
}
