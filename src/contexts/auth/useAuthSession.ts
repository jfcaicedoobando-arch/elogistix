import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Maneja exclusivamente la sesión Supabase: usuario, token y listener de
 * cambios de auth. NO carga perfil ni roles — eso vive en `useAuthProfile`.
 *
 * Política de eventos:
 *   - SIGNED_IN / SIGNED_OUT / USER_UPDATED → actualizan user + session.
 *   - TOKEN_REFRESHED / INITIAL_SESSION → actualizan session silenciosamente
 *     (sólo si cambia el access_token) para no disparar re-renders en cascada
 *     ni invalidar React Query cada vez que Supabase rota el token (~60s).
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((eventoAuth, newSession) => {
      if (eventoAuth === "TOKEN_REFRESHED" || eventoAuth === "INITIAL_SESSION") {
        handleSilentRefresh(newSession);
        return;
      }
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (
        eventoAuth === "SIGNED_IN" ||
        eventoAuth === "SIGNED_OUT" ||
        eventoAuth === "USER_UPDATED"
      ) {
        setLastEvent(eventoAuth);
      }
      setLoading(false);
    });

    // Hidratación inicial
    if (!initialized.current) {
      initialized.current = true;
      supabase.auth.getSession().then(({ data: { session: existing } }) => {
        setSession(existing);
        setUser(existing?.user ?? null);
        setLoading(false);
      });
    }

    return () => subscription.unsubscribe();
  }, [handleSilentRefresh]);

  return { user, session, loading, lastEvent };
}
