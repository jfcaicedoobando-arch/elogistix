/**
 * Inicialización de Sentry (errores + feedback widget + screenshots).
 * El DSN es público — Sentry está diseñado para que viva en el bundle del front.
 *
 * IMPORTANTE: este módulo se importa de forma DINÁMICA desde main.tsx
 * (dentro de requestIdleCallback) para que `@sentry/react` y todas sus
 * integraciones queden en `sentry-vendor` y NO en el chunk crítico.
 *
 * Constantes y helpers puros viven en `initOptions.ts` para respetar el
 * límite Power-of-10 de 200 líneas.
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
import { sampleByRoute, scrubEventPii, computePostgrestFingerprint } from "./helpers";
import { shouldDropSentryEvent, resolveSentryEnvironment } from "./dropPredicate";
import { FEEDBACK_INTEGRATION_OPTIONS } from "./feedbackConfig";
import {
  readRate,
  resolveTunnelUrl,
  scrubBreadcrumb,
  DENY_URLS,
  IGNORE_ERRORS,
  TRACE_PROPAGATION_TARGETS,
} from "./initOptions";

export {
  isReactRefreshHmrError,
  isReactRefreshStackTrace,
  sampleByRoute,
  scrubEventPii,
} from "./helpers";
export { shouldDropSentryEvent, resolveSentryEnvironment } from "./dropPredicate";

// 13.310.0 (audit Sentry PR-A): el DSN debe venir SIEMPRE por env. Antes había
// un `DEFAULT_DSN` hardcodeado — se removió porque acopla el código al proyecto
// Sentry concreto y enmascara despliegues mal configurados. Si falta
// `VITE_SENTRY_DSN`, `initSentry` no arranca (misma política que dev).
const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || "";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (!DSN) {
    if (import.meta.env.MODE !== "development") {
       
      console.warn("[sentry] VITE_SENTRY_DSN no configurado — Sentry deshabilitado");
    }
    return;
  }
  if (import.meta.env.MODE === "development") return;
  initialized = true;
  const buildHash = (import.meta.env.VITE_BUILD_HASH as string | undefined) ?? undefined;
  const isPwa =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  Sentry.init({
    dsn: DSN,
    release: `libre-carga@${APP_VERSION}`,
    dist: buildHash,
    environment: resolveSentryEnvironment(),
    initialScope: { tags: { is_pwa: isPwa ? "true" : "false" } },
    tracesSampler: sampleByRoute,
    tracePropagationTargets: TRACE_PROPAGATION_TARGETS,
    profilesSampleRate: readRate("VITE_SENTRY_PROFILES_SAMPLE_RATE", 0.1),
    replaysSessionSampleRate: readRate("VITE_SENTRY_REPLAYS_SESSION_RATE", 0),
    replaysOnErrorSampleRate: readRate("VITE_SENTRY_REPLAYS_ON_ERROR_RATE", 1.0),
    tunnel: resolveTunnelUrl(),
    // 13.312.10: explícito para blindar contra un upgrade del SDK.
    sendDefaultPii: false,
    // 13.312.10: payloads RPC de 2-3 niveles (embarque → contenedores → conceptos).
    normalizeDepth: 5,
    // 13.312.10: PostgrestError puede pasar de 500 chars con message+hint+details.
    maxValueLength: 1500,
    denyUrls: DENY_URLS,
    ignoreErrors: IGNORE_ERRORS,
    beforeSend(event, hint) {
      if (shouldDropSentryEvent(event, hint)) return null;
      // 13.320.0 (Batch 1.b): fingerprint por PostgrestError.code + ruta.
      const fp = computePostgrestFingerprint(
        hint?.originalException,
        typeof window !== "undefined" ? window.location?.pathname : undefined,
      );
      if (fp) event.fingerprint = fp;
      return scrubEventPii(event);
    },
    // 13.114.19: las transactions también pueden traer PII en `request.url`
    // (query strings con `?email=`, `?rfc=`, etc.).
    beforeSendTransaction(event) {
      // SAFE-CAST: TransactionEvent y ErrorEvent comparten la forma scrubbeable
      // (request, breadcrumbs, user). `scrubEventPii` sólo lee/escribe campos
      // comunes; el doble cast evita duplicar la lógica de redacción.
      return scrubEventPii(event as unknown as Sentry.ErrorEvent) as unknown as typeof event;
    },
    beforeBreadcrumb: scrubBreadcrumb,
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
      // Empezamos en 500-599 para no inflar la cuota.
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
        // 13.310.0 (audit PR-B): explícito. Blindaje contra regresión silenciosa
        // si un upgrade cambia los defaults.
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
