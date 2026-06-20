/**
 * Construcción del snapshot global de auth para uso fuera de React (errorReport, Sentry).
 * Extraído de `AuthContext.tsx` para mantener complejidad <15.
 */
import type { User } from "@supabase/supabase-js";
import type { AppRole } from "@/types/appRole";
import type { CachedOrganization } from "@/lib/contexts/auth/useAuthProfile";

interface ProfileLike {
  organizationId: string | null;
  organization: CachedOrganization | null;
  role: AppRole | null;
}

export function buildAuthSnapshot(
  user: User | null,
  profile: ProfileLike,
  effectiveRole: AppRole | null,
) {
  return {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    organizationId: profile.organizationId ?? null,
    organizationName: profile.organization?.nombre ?? null,
    role: profile.role ?? null,
    effectiveRole: effectiveRole ?? null,
  };
}

export function buildSentryUserContext(
  user: User | null,
  profile: ProfileLike,
  effectiveRole: AppRole | null,
) {
  return {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    organizationId: profile.organizationId ?? null,
    effectiveRole: effectiveRole ?? null,
  };
}
