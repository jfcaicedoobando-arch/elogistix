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

export function logClientError({ message, stack, componentStack }: ClientErrorPayload): void {
  try {
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
