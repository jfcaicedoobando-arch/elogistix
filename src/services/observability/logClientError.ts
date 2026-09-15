/**
 * Reporta errores del cliente a `app_logs` vía edge function.
 * Fire-and-forget — nunca debe propagar excepción ni romper la UI.
 *
 * Refactor 8.193.0: extraído de `components/shared/ErrorBoundary.tsx`
 * para no llamar a Supabase directamente desde la capa de presentación
 * (auditoría arquitectónica P0.2).
 */
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/constants/appVersion";
import { scrubUrl } from "@/lib/observability/piiScrub";

export interface ClientErrorPayload {
  message: string;
  stack?: string;
  componentStack?: string | null;
}

/**
 * Freno del lado del cliente: un ErrorBoundary en bucle disparaba cientos de
 * invocaciones a `client-error-log` y el backend respondía 429 `rate_limited`,
 * dejando pantalla en blanco. Se ignora el mismo mensaje dentro de la ventana
 * y se limita el total de reportes por sesión de pestaña.
 */
const VENTANA_DEDUPE_MS = 60_000;
const MAX_REPORTES_SESION = 10;
const ultimoEnvioPorMensaje = new Map<string, number>();
let reportesEnviados = 0;

/** Sólo para pruebas: reinicia el freno en memoria. */
export function __resetLogClientErrorThrottle(): void {
  ultimoEnvioPorMensaje.clear();
  reportesEnviados = 0;
}

function debeReportar(message: string): boolean {
  if (reportesEnviados >= MAX_REPORTES_SESION) return false;
  const ahora = Date.now();
  const previo = ultimoEnvioPorMensaje.get(message);
  if (previo !== undefined && ahora - previo < VENTANA_DEDUPE_MS) return false;
  ultimoEnvioPorMensaje.set(message, ahora);
  reportesEnviados += 1;
  return true;
}

export function logClientError({ message, stack, componentStack }: ClientErrorPayload): void {
  try {
    if (!debeReportar(message)) return;
    void supabase.functions.invoke("client-error-log", {
      body: {
        message,
        stack: stack ?? null,
        component_stack: componentStack ?? null,
        // Se pasa por scrubUrl para no persistir tokens públicos
        // (/tracking/<32-hex>, /portal/proformas/<uuid>, ?token=…) en
        // app_logs: son credenciales de acceso (la proforma hasta permite
        // aceptar/rechazar) y los logs los lee staff/SaaS de terceros.
        route:
          typeof window !== "undefined"
            ? scrubUrl(window.location.pathname + window.location.search) ?? null
            : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        app_version: APP_VERSION,
      },
    });
  } catch {
    // ignorar — no queremos cascadas de error desde el reporter
  }
}
