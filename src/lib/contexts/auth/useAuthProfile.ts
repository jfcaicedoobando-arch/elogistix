import { useCallback, useEffect, useRef, useState } from "react";
import type { AppRole } from "@/types/appRole";
import { fetchUserContext, type CachedOrganization } from "@/features/auth/services";

export type { CachedOrganization };

export interface AuthProfile {
  role: AppRole | null;
  orgRole: AppRole | null;
  organizationId: string | null;
  organization: CachedOrganization | null;
}

const EMPTY_PROFILE: AuthProfile = {
  role: null,
  orgRole: null,
  organizationId: null,
  organization: null,
};

/** TTL para no re-fetchear el contexto del usuario en cascada. */
const CONTEXT_TTL_MS = 60_000;

/**
 * Carga perfil + roles + organización del usuario autenticado vía
 * `services/auth.fetchUserContext`. Mantiene cache TTL e in-flight de-dupe.
 */
export function useAuthProfile(userId: string | null) {
  const [profile, setProfile] = useState<AuthProfile>(EMPTY_PROFILE);
  const lastFetchedFor = useRef<string | null>(null);
  const lastFetchedAt = useRef<number>(0);
  const inflight = useRef<Promise<void> | null>(null);

  const fetchContext = useCallback(async (uid: string) => {
    const now = Date.now();
    if (lastFetchedFor.current === uid && now - lastFetchedAt.current < CONTEXT_TTL_MS) {
      return;
    }
    if (inflight.current) {
      return inflight.current;
    }
    const promise = (async () => {
      try {
        const payload = await fetchUserContext();
        if (!payload) return; // mantener perfil previo
        setProfile(payload);
        lastFetchedFor.current = uid;
        lastFetchedAt.current = Date.now();
      } catch (err) {
        // No envenenar el perfil. El listener de auth puede reintentar.
        console.error("[useAuthProfile] fetchUserContext failed", err);
        void import("@sentry/react").then(({ captureException }) =>
          captureException(err, { tags: { feature: "auth", phase: "fetchUserContext" }, extra: { uid } }),
        ).catch(() => undefined);
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = promise;
    return promise;
  }, []);

  const reset = useCallback(() => {
    setProfile(EMPTY_PROFILE);
    lastFetchedFor.current = null;
    lastFetchedAt.current = 0;
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    // Forzar bypass de TTL
    lastFetchedAt.current = 0;
    await fetchContext(userId);
  }, [userId, fetchContext]);

  useEffect(() => {
    if (userId) {
      // Defer para evitar potencial deadlock con Supabase durante eventos de auth.
      const t = setTimeout(() => fetchContext(userId), 0);
      return () => clearTimeout(t);
    }
    reset();
  }, [userId, fetchContext, reset]);

  return { profile, reset, refresh };
}
