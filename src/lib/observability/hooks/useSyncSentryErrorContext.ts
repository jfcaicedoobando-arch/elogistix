/**
 * Hook que mantiene `errorContextStore` sincronizado con AuthContext +
 * OrganizationContext + ruta actual. Montado UNA sola vez en `<App />`
 * para que cualquier `reportCaughtError` posterior tenga tenant y route
 * frescos sin prop drilling.
 *
 * 13.141.8 — auditoría Sentry.
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { setErrorContext } from "@/lib/observability/errorContextStore";

export function useSyncSentryErrorContext(): void {
  const { user, effectiveRole, organizationId } = useAuth();
  const { organization } = useOrganization();
  const location = useLocation();

  useEffect(() => {
    setErrorContext({
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      effectiveRole: effectiveRole ?? null,
      organizationId: organization?.id ?? organizationId ?? null,
      organizationName: organization?.nombre ?? null,
      route: location.pathname,
    });
  }, [
    user?.id,
    user?.email,
    effectiveRole,
    organizationId,
    organization?.id,
    organization?.nombre,
    location.pathname,
  ]);
}
