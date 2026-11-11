type SentryScope = Pick<typeof import("@sentry/react"),
  "isEnabled" | "setUser" | "setTags" | "setAttributes" | "setTag" | "setAttribute">;

interface SyncParams {
  userId: string | null;
  email: string | null;
  organizationId: string | null;
  effectiveRole: string | null;
}

let scope: SentryScope | null = null;
let pending: SyncParams | null = null;
let activeOrg: string | null = null;

/** Auth conserva el contexto vigente aunque el SDK siga pendiente de cargar. */
export function connectSentryScope(sdk: SentryScope): void {
  scope = sdk;
  applyUserScope();
}

function applyUserScope(): void {
  if (!scope?.isEnabled() || !pending) return;
  const { userId, organizationId, effectiveRole } = pending;
  const tags = {
    organization_id: userId ? organizationId ?? "none" : "none",
    effective_role: userId ? effectiveRole ?? "none" : "none",
    active_organization_id: userId ? activeOrg ?? "none" : "none",
    auth_status: userId ? "authenticated" : "anonymous",
  };
  scope.setUser(userId ? { id: userId } : null);
  scope.setTags(tags);
  scope.setAttributes(tags);
}

export function syncSentryUser(params: SyncParams): void {
  pending = params;
  if (!params.userId) activeOrg = null;
  applyUserScope();
}

/** Refleja la organización activa al cambiar de tenant sin cambiar de sesión. */
export function syncSentryActiveOrg(orgId: string | null): void {
  activeOrg = orgId;
  if (!scope?.isEnabled()) return;
  const value = activeOrg ?? "none";
  scope.setTag("active_organization_id", value);
  scope.setAttribute("active_organization_id", value);
}
