import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  subscribeToAuthChanges,
  getCurrentSession,
} from "@/features/auth/services";

/**
 * Maneja exclusivamente la sesión Supabase: usuario, token y listener de
 * cambios de auth. NO carga perfil ni roles — eso vive en `useAuthProfile`.
 */
export interface AuthSession {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** evento de la última transición distinta a TOKEN_REFRESHED/INITIAL_SESSION */
  lastEvent: "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | null;
}

export function useAuthSession(): AuthSession {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastEvent, setLastEvent] = useState<AuthSession["lastEvent"]>(null);

  const initialized = useRef(false);

  const handleSilentRefresh = useCallback((newSession: Session | null) => {
    setSession((prev) =>
      prev?.access_token === newSession?.access_token ? prev : newSession,
    );
  }, []);

  useEffect(() => {
    const subscription = subscribeToAuthChanges((eventoAuth, newSession) => {
      if (eventoAuth === "TOKEN_REFRESHED") {
        handleSilentRefresh(newSession);
        return;
      }
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      if (
        eventoAuth === "SIGNED_IN" ||
        eventoAuth === "SIGNED_OUT" ||
        eventoAuth === "USER_UPDATED"
      ) {
        setLastEvent(eventoAuth);
      }
    });

    // Red de seguridad: si INITIAL_SESSION no llegara, hidratamos manualmente.
    if (!initialized.current) {
      initialized.current = true;
      getCurrentSession()
        .then((existing) => {
          setSession((prev) => prev ?? existing);
          setUser((prev) => prev ?? existing?.user ?? null);
          setLoading(false);
        })
        .catch((err) => {
          // Si Supabase falla aquí no debe romper la UI: dejamos user/session
          // en null y `loading=false`. El listener subscribirá los siguientes.
          console.error("[useAuthSession] getCurrentSession failed", err);
          // Reportar a Sentry sin bloquear (lazy import para no inflar bundle).
          void import("@sentry/react").then(({ captureException }) =>
            captureException(err, { tags: { feature: "auth", phase: "getCurrentSession" } }),
          ).catch(() => undefined);
          setLoading(false);
        });
    }

    return () => subscription.unsubscribe();
  }, [handleSilentRefresh]);

  return { user, session, loading, lastEvent };
}
