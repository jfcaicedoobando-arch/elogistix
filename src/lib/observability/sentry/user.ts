/**
 * Wrapper liviano para sincronizar el usuario actual con Sentry SIN forzar
 * la carga estática de `@sentry/react` (que pesa ~150 KB y debe vivir en el
 * módulo de configuración cargado de forma diferida desde `main.tsx`).
 *
 * AuthContext no carga Replay/feedback/configuración a través de este helper.
 * El adaptador de rutas importa el SDK base de forma independiente.
 */

interface SyncParams {
  userId: string | null;
  email: string | null;
  organizationId: string | null;
  effectiveRole: string | null;
}
import { loadInitializedSentry } from "./runtime";

/**
 * Cola para llamadas que ocurran antes de que `@sentry/react` termine de
 * inicializarse en el bootstrap. Sólo guardamos la última: el usuario "vigente"
 * es siempre el más reciente.
 */
let pending: SyncParams | null = null;
let activeOrg: string | null = null;

export function syncSentryUser(params: SyncParams): void {
  pending = params;
  if (!params.userId) activeOrg = null;
  loadInitializedSentry()
    .then((Sentry) => {
      // Si llegaron más llamadas mientras cargaba, sólo aplicar la última.
      const latest = pending;
      if (!latest || !Sentry) return;
      const tags = {
        organization_id: latest.userId ? latest.organizationId ?? "none" : "none",
        effective_role: latest.userId ? latest.effectiveRole ?? "none" : "none",
        active_organization_id: latest.userId ? activeOrg ?? "none" : "none",
        auth_status: latest.userId ? "authenticated" : "anonymous",
      };
      Sentry.setUser(latest.userId ? { id: latest.userId } : null);
      Sentry.setTags(tags);
      // SDK 11 scope tags do not propagate to streamed spans.
      Sentry.setAttributes(tags);
    })
    .catch(() => {
      // Sentry es best-effort; un fallo al cargar el SDK no debe romper auth.
    });
}

/**
 * Refresca el tag `active_organization_id` en el scope global de Sentry.
 * Usar cuando un super-admin cambia de organización activa (impersonación)
 * sin re-loguear: garantiza que cualquier evento posterior llegue tagueado
 * con el tenant real que el usuario estaba viendo.
 */
export function syncSentryActiveOrg(orgId: string | null): void {
  activeOrg = orgId;
  loadInitializedSentry()
    .then((Sentry) => {
      if (!Sentry) return;
      const value = activeOrg ?? "none";
      Sentry.setTag("active_organization_id", value);
      Sentry.setAttribute("active_organization_id", value);
    })
    .catch(() => {
      // best-effort
    });
}
