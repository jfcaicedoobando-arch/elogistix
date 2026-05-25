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
import { isDynamicImportErrorMessage } from "@/lib/ui/dynamicImportError";

const DSN = "https://e44f92892772533298354b89d9ef3ddb@o4511415732404224.ingest.us.sentry.io/4511415734108160";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;
  Sentry.init({
    dsn: DSN,
    release: `libre-carga@${APP_VERSION}`,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
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
