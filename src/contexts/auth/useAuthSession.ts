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
      // Sólo TOKEN_REFRESHED es 100% silencioso (rota ~60s y no debe invalidar
      // React Query ni recolocar el árbol). INITIAL_SESSION es el evento
      // canónico de arranque y DEBE hidratar user+session+loading, igual que
      // SIGNED_IN / SIGNED_OUT / USER_UPDATED. Antes lo tratábamos como
      // silencioso y dejaba `user=null` con `session!=null` durante una
      // ventana de carrera (ver fix 10.2.2).
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

    // Red de seguridad: si por alguna razón INITIAL_SESSION no llegara,
    // hidratamos desde getSession() una sola vez.
    if (!initialized.current) {
      initialized.current = true;
      supabase.auth.getSession().then(({ data: { session: existing } }) => {
        setSession((prev) => prev ?? existing);
        setUser((prev) => prev ?? existing?.user ?? null);
        setLoading(false);
      });
    }

    return () => subscription.unsubscribe();
  }, [handleSilentRefresh]);

  return { user, session, loading, lastEvent };
}
