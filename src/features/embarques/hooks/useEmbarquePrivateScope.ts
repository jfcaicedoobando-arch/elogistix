import { useSyncExternalStore } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { getSessionCacheGeneration, subscribeSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";

/** Keep private React Query results separate even before the service runs again. */
export function useEmbarquePrivateScope() {
  const { user, effectiveRole, loading: authLoading } = useAuth();
  const { organizationId, loading: orgLoading } = useOrganization();
  const generation = useSyncExternalStore(subscribeSessionCacheGeneration, getSessionCacheGeneration, getSessionCacheGeneration);
  const ready = !authLoading && !orgLoading && Boolean(user?.id && organizationId && effectiveRole);
  return {
    key: [user?.id ?? null, organizationId, effectiveRole, generation] as const,
    ready,
    staff: ready && effectiveRole !== "cliente" && effectiveRole !== "agente_carga",
  };
}
