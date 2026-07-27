/**
 * Wrapper liviano para sincronizar el usuario actual con Sentry SIN forzar
 * la carga estática de `@sentry/react` (que pesa ~150 KB y debe vivir en el
 * chunk `sentry-vendor` cargado de forma diferida desde `main.tsx`).
 *
 * Esto evita que AuthContext (crítico) arrastre el SDK al bundle inicial.
 */

interface SyncParams {
  userId: string | null;
  email: string | null;
  organizationId: string | null;
  effectiveRole: string | null;
}

/**
 * Cola para llamadas que ocurran antes de que `@sentry/react` termine de
 * cargarse en el idle callback. Sólo guardamos la última: el usuario "vigente"
 * es siempre el más reciente.
 */
let pending: SyncParams | null = null;
let sentryModulePromise: Promise<typeof import("@sentry/react")> | null = null;

function loadSentry(): Promise<typeof import("@sentry/react")> {
  if (!sentryModulePromise) {
    sentryModulePromise = import("@sentry/react");
  }
  return sentryModulePromise;
}

export function syncSentryUser(params: SyncParams): void {
  pending = params;
  loadSentry()
    .then((Sentry) => {
      // Si llegaron más llamadas mientras cargaba, sólo aplicar la última.
      const latest = pending;
      if (!latest) return;
      if (!latest.userId) {
        Sentry.setUser(null);
        // 13.320.0 (audit Sentry Batch 1.c): distinguir eventos anon vs auth
        // en filtros de Sentry. Antes ambos casos quedaban sin tag.
        Sentry.getCurrentScope().setTag("auth_status", "anonymous");
        return;
      }
      Sentry.setUser({ id: latest.userId, email: latest.email ?? undefined });
      Sentry.setTags({
        organization_id: latest.organizationId ?? "none",
        effective_role: latest.effectiveRole ?? "none",
        auth_status: "authenticated",
      });
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
  loadSentry()
    .then((Sentry) => {
      Sentry.getCurrentScope().setTag("active_organization_id", orgId ?? "none");
    })
    .catch(() => {
      // best-effort
    });
}
