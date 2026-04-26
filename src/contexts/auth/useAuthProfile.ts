import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/appRole";

export interface CachedOrganization {
  id: string;
  nombre: string;
  rfc: string | null;
  logo_url: string | null;
  plan: string | null;
  activo: boolean | null;
}

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
 * Carga perfil + roles + organización del usuario autenticado vía RPC
 * `get_user_context`. Mantiene cache TTL e in-flight de-dupe.
 *
 * Recibe `userId` desde `useAuthSession` para reaccionar a cambios de sesión
 * sin acoplarse al listener.
 */
export function useAuthProfile(userId: string | null) {
  const [profile, setProfile] = useState<AuthProfile>(EMPTY_PROFILE);
  const lastFetchedFor = useRef<string | null>(null);
  const lastFetchedAt = useRef<number>(0);
  const inflight = useRef<Promise<void> | null>(null);

  const fetchUserContext = useCallback(async (uid: string) => {
    const now = Date.now();
    if (lastFetchedFor.current === uid && now - lastFetchedAt.current < CONTEXT_TTL_MS) {
      return;
    }
    if (inflight.current) {
      return inflight.current;
    }
    const promise = (async () => {
      try {
        const { data, error } = await supabase.rpc("get_user_context");
        if (error) throw error;
        const payload = (data ?? {}) as {
          role?: string | null;
          orgRole?: string | null;
          organizationId?: string | null;
          organization?: CachedOrganization | null;
        };
        setProfile({
          role: (payload.role as AppRole) ?? null,
          orgRole: (payload.orgRole as AppRole) ?? null,
          organizationId: payload.organizationId ?? null,
          organization: payload.organization ?? null,
        });
        lastFetchedFor.current = uid;
        lastFetchedAt.current = Date.now();
      } catch {
        // silent — keep previous profile
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

  // Reaccionar a cambios del userId expuesto por la sesión.
  useEffect(() => {
    if (userId) {
      // Defer para evitar potencial deadlock con el cliente Supabase durante un evento de auth.
      const t = setTimeout(() => fetchUserContext(userId), 0);
      return () => clearTimeout(t);
    }
    reset();
  }, [userId, fetchUserContext, reset]);

  return { profile, reset };
}
