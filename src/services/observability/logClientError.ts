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
        route:
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        app_version: APP_VERSION,
      },
    });
  } catch {
    // ignorar — no queremos cascadas de error desde el reporter
  }
}
