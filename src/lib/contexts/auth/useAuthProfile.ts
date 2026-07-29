import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
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

/** Mismo TTL que la versión manual (60s), ahora expresado como `staleTime`. */
const USER_CONTEXT_STALE_MS = 60_000;

/**
 * Carga perfil + roles + organización del usuario autenticado vía
 * `services/auth.fetchUserContext`.
 *
 * M9 (auditoría 2026-07-29): migrado de cache manual (TTL + refs in-flight) a
 * TanStack Query — dedupe, `staleTime` y revalidación los da el queryClient;
 * `refresh()` es un `invalidateQueries` y `reset()` un `removeQueries`.
 * La firma pública `{ profile, reset, refresh }` no cambia.
 */
export function useAuthProfile(userId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.auth.userContext(userId),
    enabled: !!userId,
    staleTime: USER_CONTEXT_STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async ({ queryKey }) => {
      try {
        const payload = await fetchUserContext();
        if (!payload) {
          // Paridad con la versión TTL: mantener el perfil previo si el
          // contexto no está disponible transitoriamente (evita parpadeos y
          // falsos "sin organización" durante eventos de auth).
          return queryClient.getQueryData<AuthProfile>(queryKey) ?? EMPTY_PROFILE;
        }

        return payload;
      } catch (err) {
        // No envenenar el perfil: el listener de auth puede reintentar.
        console.error("[useAuthProfile] fetchUserContext failed", err);
        void import("@sentry/react")
          .then(({ captureException }) =>
            captureException(err, { tags: { feature: "auth", phase: "fetchUserContext" }, extra: { uid: userId } }),
          )
          .catch(() => undefined);
        throw err;
      }
    },
  });

  const profile = userId ? (data ?? EMPTY_PROFILE) : EMPTY_PROFILE;

  const reset = useCallback(() => {
    queryClient.removeQueries({ queryKey: queryKeys.auth.userContextAll });
  }, [queryClient]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.auth.userContextAll });
  }, [userId, queryClient]);

  return { profile, profileLoading: !!userId && profileLoading, reset, refresh };
}
