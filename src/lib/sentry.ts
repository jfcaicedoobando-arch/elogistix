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
import { APP_VERSION } from "@/constants/appVersion";
import { isDynamicImportErrorMessage } from "@/lib/errors/dynamicImportError";

/** Detecta si un error proviene de React Refresh / HMR de Vite.
 *  Ocurre cuando un bundle stale intenta re-renderizar y referencia
 *  variables (hooks, estado) que ya no existen tras hot reload.
 *  Ejemplo: "ReferenceError: pendienteOpen is not defined". */
export function isReactRefreshHmrError(error: Error): boolean {
  if (!error.message?.includes("is not defined")) return false;
  const stack = error.stack ?? "";
  return /react-refresh|performReactRefresh|scheduleRefresh/i.test(stack);
}

/** Detecta stacktrace de React Refresh en frames de Sentry. */
function isReactRefreshStackTrace(
  stacktrace: unknown
): boolean {
  if (!stacktrace || typeof stacktrace !== "object") return false;
  const frames = (stacktrace as { frames?: Array<{ abs_path?: string; function?: string }> }).frames;
  if (!Array.isArray(frames)) return false;
  return frames.some(
    (f) =>
      f.abs_path?.includes("@react-refresh") ||
      f.function?.includes("performReactRefresh") ||
      f.function?.includes("scheduleRefresh")
  );
}

// DSN del proyecto elogistix/javascript-react (clave pública, segura en bundle).
// `VITE_SENTRY_DSN` permite override por entorno; si no está, usamos el default
// para garantizar que el SDK quede inicializado en builds publicados.
const DEFAULT_DSN =
  "https://e44f92892772533298354b89d9ef3ddb@o4511415732404224.ingest.us.sentry.io/4511415734108160";
const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || DEFAULT_DSN;

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (!DSN) return;
  // No inicializar en desarrollo: las sesiones locales generan ruido por HMR
  // (React Refresh, módulos stale) que no representa bugs reales.
  if (import.meta.env.MODE === "development") return;
  initialized = true;
  Sentry.init({
    dsn: DSN,
    release: `libre-carga@${APP_VERSION}`,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,

    // Defensa en profundidad: estos errores de Vite (chunk viejo cacheado)
    // se auto-recuperan con reload y no aportan señal. `ignoreErrors` corre
    // antes que `beforeSend` y cubre también releases viejos en caché.
    ignoreErrors: [
      /Failed to fetch dynamically imported module/i,
      /Importing a module script failed/i,
      /error loading dynamically imported module/i,
      /Loading chunk \d+ failed/i,
      /ChunkLoadError/i,
      // React Refresh / HMR de Vite: ruido exclusivo de desarrollo local.
      /Should have a queue\. This is likely a bug in React/i,
      /Invalid Refresh Token: Refresh Token Not Found/i,
    ],
    beforeSend(event, hint) {
      // Filtrar errores transitorios de carga de chunks (Vite): la app se
      // auto-recupera con un reload, no aportan señal a Sentry.
      const originalMsg =
        (hint?.originalException as Error | undefined)?.message ??
        (typeof hint?.originalException === "string" ? hint.originalException : undefined);
      if (isDynamicImportErrorMessage(originalMsg)) return null;
      if (isDynamicImportErrorMessage(event.message)) return null;
      const values = event.exception?.values;
      if (values && values.some((v) => isDynamicImportErrorMessage(v.value))) return null;

      // Filtrar errores de React Refresh / HMR: el bundle stale intenta
      // re-renderizar componentes con variables que ya no existen tras hot reload.
      const exc = hint?.originalException as Error | undefined;
      if (exc && isReactRefreshHmrError(exc)) return null;
      if (values && values.some((v) => isReactRefreshStackTrace(v.stacktrace))) return null;

      return event;
    },
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.feedbackIntegration({
        autoInject: false,
        colorScheme: "light",
        showBranding: false,
        showName: false,
        showEmail: false,
        enableScreenshot: true,
        triggerLabel: "Reportar bug o sugerencia",
        formTitle: "Reportar bug o sugerencia",
        submitButtonLabel: "Enviar reporte",
        cancelButtonLabel: "Cancelar",
        addScreenshotButtonLabel: "Agregar captura",
        removeScreenshotButtonLabel: "Quitar captura",
        nameLabel: "Nombre",
        namePlaceholder: "Tu nombre",
        emailLabel: "Correo",
        emailPlaceholder: "tu@correo.com",
        messageLabel: "Descripción",
        messagePlaceholder: "Cuéntanos qué pasó. Incluye pasos para reproducirlo.",
        successMessageText: "¡Gracias! Recibimos tu reporte.",
        isRequiredLabel: "(obligatorio)",
      }),
    ],
  });
}

/** True una vez `initSentry()` se ha invocado al menos una vez. */
export function isSentryReady(): boolean {
  return initialized;
}
