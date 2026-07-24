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
import { scrubPii, scrubUrl, isSensitiveApiUrl } from "@/lib/observability/piiScrub";
import { sampleByRoute, scrubEventPii } from "./helpers";
import { shouldDropSentryEvent, resolveSentryEnvironment } from "./dropPredicate";
import { FEEDBACK_INTEGRATION_OPTIONS } from "./feedbackConfig";

export {
  isReactRefreshHmrError,
  isReactRefreshStackTrace,
  sampleByRoute,
  scrubEventPii,
} from "./helpers";
export { shouldDropSentryEvent, resolveSentryEnvironment } from "./dropPredicate";

// 13.310.0 (audit Sentry PR-A): el DSN debe venir SIEMPRE por env. Antes había
// un `DEFAULT_DSN` hardcodeado como red de seguridad — se removió porque:
// (1) crea acoplamiento del código al proyecto Sentry concreto y bloquea forks
// autohospedados; (2) enmascara despliegues mal configurados que aparentan
// funcionar. Si falta `VITE_SENTRY_DSN`, `initSentry` no arranca (misma
// política que `MODE=development`).
const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || "";

/** Lee un sample rate opcional de env, clamp a [0,1]. Si no hay valor válido
 *  usa `fallback` para no romper comportamiento previo. */
function readRate(key: string, fallback: number): number {
  const raw = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/** Hosts a los que adjuntar `sentry-trace` / `baggage` para trazas distribuidas
 *  front ↔ edge functions. Incluye el proyecto Supabase y dominios productivos. */
const TRACE_PROPAGATION_TARGETS: Array<string | RegExp> = [
  /^\/(api|functions)\//,
  /\.supabase\.co\/functions\/v1\//,
  /librecarga\.com/,
];

// 13.312.10 (audit Sentry PR-C): orígenes de código ajeno a la app que jamás
// deben producir eventos. Extensiones del navegador y scripts de terceros
// inyectados por hosting / analytics generan errores que no podemos corregir.
const DENY_URLS: Array<string | RegExp> = [
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-(web-)?extension:\/\//i,
  /extensions\//i,
  // Scripts inyectados por hosting (Lovable analytics, GTM, etc.)
  /\/gtag\/js/i,
  /googletagmanager\.com/i,
  /\/flock\.js/i,
];

// 13.312.10: URL del túnel Sentry sólo si tenemos base de Supabase configurada;
// evita apuntar a `undefined/functions/v1/sentry-tunnel` en despliegues mal
// configurados (que además dispara CORS ruidoso en la consola).
function resolveTunnelUrl(): string | undefined {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base || typeof base !== "string") return undefined;
  return `${base.replace(/\/$/, "")}/functions/v1/sentry-tunnel`;
}



let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  // 13.310.0: sin DSN NO inicializamos. Warn explícito para preview/prod para
  // que un despliegue mal configurado no se detecte tarde.
  if (!DSN) {
    if (import.meta.env.MODE !== "development") {
       
      console.warn("[sentry] VITE_SENTRY_DSN no configurado — Sentry deshabilitado");
    }
    return;
  }
  // No inicializar en desarrollo: las sesiones locales generan ruido por HMR.
  if (import.meta.env.MODE === "development") return;
  initialized = true;
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
    environment: resolveSentryEnvironment(),
    // 13.310.0: initialScope evita la ventana en la que un evento temprano
    // se envía antes de `setTag("is_pwa")`.
    initialScope: { tags: { is_pwa: isPwa ? "true" : "false" } },
    tracesSampler: sampleByRoute,
    tracePropagationTargets: TRACE_PROPAGATION_TARGETS,
    // 13.310.0: sample rates configurables por env con los defaults previos.
    profilesSampleRate: readRate("VITE_SENTRY_PROFILES_SAMPLE_RATE", 0.1),
    replaysSessionSampleRate: readRate("VITE_SENTRY_REPLAYS_SESSION_RATE", 0),
    replaysOnErrorSampleRate: readRate("VITE_SENTRY_REPLAYS_ON_ERROR_RATE", 1.0),
    tunnel: resolveTunnelUrl(),
    // 13.312.10: explícito para blindar contra un upgrade del SDK que cambie
    // el default. `sendDefaultPii: false` bloquea que Sentry adjunte cookies,
    // IP y headers del navegador automáticamente.
    sendDefaultPii: false,
    // 13.312.10: los payloads de RPC (`extra.payload`) son objetos de 2-3
    // niveles (embarque → contenedores → conceptos). Con depth 3 el SDK
    // convierte los niveles internos a `"[Object]"` y perdemos contexto.
    normalizeDepth: 5,
    // 13.312.10: los mensajes de PostgrestError incluyen `message` + `hint` +
    // `details` que suman >500 chars. 250 (default) los recorta.
    maxValueLength: 1500,
    denyUrls: DENY_URLS,


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
      // 13.142.8: credenciales incorrectas en login — es UX esperada, no bug.
      /Invalid login credentials/i,
      // 13.312.10: ruido de navegador / scanners de correo (Outlook safelink),
      // Safari offline y extensiones. No corregibles desde nuestro código.
      /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i,
      /Non-Error promise rejection captured/i,
      /Object Not Found Matching Id/i,
      /^Load failed$/i,
      /NetworkError when attempting to fetch resource/i,
      /Extension context invalidated/i,
      /The operation was aborted/i,
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
      // 13.312.10 (audit Sentry PR-C): captura `Error.cause` y propiedades
      // enumerables (útil para `PostgrestError` que trae `code/hint/details`
      // como campos, no como parte del stack). Depth 5 alineado a normalizeDepth.
      Sentry.extraErrorDataIntegration({ depth: 5, captureErrorCause: true }),

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
        // 13.310.0 (audit PR-B): explícito. Antes dependíamos del default del
        // SDK; dejarlo escrito evita una regresión silenciosa si un upgrade
        // cambia los defaults y filtra contenido de <input>/<textarea>.
        maskAllInputs: true,
        blockAllMedia: true,
      }),
      Sentry.feedbackIntegration(FEEDBACK_INTEGRATION_OPTIONS),
    ],
  });
}


/** True una vez `initSentry()` se ha invocado al menos una vez. */
export function isSentryReady(): boolean {
  return initialized;
}
