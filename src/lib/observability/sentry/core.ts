/**
 * Inicialización de Sentry (errores + feedback widget + screenshots).
 * El DSN es público — Sentry está diseñado para que viva en el bundle del front.
 *
 * Se carga dinámicamente desde el bootstrap. Replay/feedback no deben
 * bloquear el primer render; los errores de arranque se encolan aparte.
 *
 * Constantes y helpers puros viven en `initOptions.ts` para respetar el
 * límite Power-of-10 de 200 líneas.
 */
import * as Sentry from "@sentry/react";
import { reactRouterBrowserTracingIntegration } from "@sentry/react/react-router";
import { APP_VERSION } from "@/constants/appVersion";
import { sampleByRoute, scrubEventPii, computePostgrestFingerprint } from "./helpers";
import { shouldDropSentryEvent, resolveSentryEnvironment } from "./dropPredicate";
import { FEEDBACK_INTEGRATION_OPTIONS } from "./feedbackConfig";
import { scrubSpanPii } from "./spanPrivacy";
import { markSentryReady } from "./runtimeState";
import {
  readRate,
  resolveTunnelUrl,
  scrubBreadcrumb,
  DENY_URLS,
  IGNORE_ERRORS,
  HTTP_FAILURE_TARGETS,
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
  // Unit/benchmark failures must never reach the project's real DSN.
  if (import.meta.env.MODE === "development" || import.meta.env.MODE === "test") return;
  if (!DSN) {
    if (import.meta.env.MODE !== "development") {
       
      console.warn("[sentry] VITE_SENTRY_DSN no configurado — Sentry deshabilitado");
    }
    return;
  }
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
    // SDK 11: `profilesSampleRate` se retiró; equivalente oficial por sesión
    // con ciclo "trace" (perfila mientras hay spans activos, como antes).
    profileSessionSampleRate: readRate("VITE_SENTRY_PROFILES_SAMPLE_RATE", 0.1),
    profileLifecycle: "trace",
    // 13.320.1 (audit Sentry Batch 3): default 0 → 0.02 (2% de sesiones).
    // Replays con PII enmascarada nos dan reproducción visual sin explotar cuota.
    // Override por env `VITE_SENTRY_REPLAYS_SESSION_RATE`.
    replaysSessionSampleRate: readRate("VITE_SENTRY_REPLAYS_SESSION_RATE", 0.02),
    replaysOnErrorSampleRate: readRate("VITE_SENTRY_REPLAYS_ON_ERROR_RATE", 1.0),
    tunnel: resolveTunnelUrl(),
    // SDK 11 retiró `sendDefaultPii`; equivalente estricto (sin PII por defecto).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
    },
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
    beforeSendSpan: scrubSpanPii,
    beforeBreadcrumb: scrubBreadcrumb,
    integrations: [
      reactRouterBrowserTracingIntegration(),
      Sentry.browserProfilingIntegration(),
      // 13.312.10 (audit Sentry PR-C): captura `Error.cause` y propiedades
      // enumerables (útil para `PostgrestError` que trae `code/hint/details`
      // como campos, no como parte del stack). Depth 5 alineado a normalizeDepth.
      Sentry.extraErrorDataIntegration({ depth: 5, captureErrorCause: true }),
      // Query/UI owns REST/Edge errors after retries; automatic capture remains
      // for other HTTP failures. Breadcrumbs/tracing still cover all requests.
      Sentry.httpClientIntegration({
        failedRequestStatusCodes: [[500, 599]],
        failedRequestTargets: HTTP_FAILURE_TARGETS,
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
  initialized = Sentry.isEnabled();
  if (initialized) markSentryReady();
}

/** A client object/event ID alone does not prove transport is enabled. */
export function isSentryReady(): boolean {
  return initialized && Sentry.isEnabled();
}
