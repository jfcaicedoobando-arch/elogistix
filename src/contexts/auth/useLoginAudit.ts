import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Registra la actividad de login en bitácora una sola vez por sesión por usuario,
 * con guarda en sessionStorage para evitar re-loguear en refresh de pestaña.
 */
export function useLoginAudit(
  user: User | null,
  lastEvent: "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | null,
) {
  const hasLoggedLogin = useRef(false);

  const registrarLogin = useCallback(async (userId: string, email: string) => {
    try {
      await supabase.from("bitacora_actividad").insert([
        {
          usuario_id: userId,
          usuario_email: email,
          accion: "login",
          modulo: "auth",
          entidad_nombre: email,
        },
      ]);
    } catch {
      // No bloquear login si falla el registro
    }
  }, []);

  useEffect(() => {
    if (lastEvent !== "SIGNED_IN" || !user || hasLoggedLogin.current) return;
    const loginKey = `lc:login-logged:${user.id}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(loginKey)) {
      hasLoggedLogin.current = true;
      return;
    }
    hasLoggedLogin.current = true;
    try {
      sessionStorage?.setItem(loginKey, "1");
    } catch {
      /* noop */
    }
    const t = setTimeout(() => registrarLogin(user.id, user.email ?? ""), 100);
    return () => clearTimeout(t);
  }, [lastEvent, user, registrarLogin]);

  const clearLoginAudit = useCallback((userId: string | undefined) => {
    hasLoggedLogin.current = false;
    if (!userId) return;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(`lc:login-logged:${userId}`);
      }
    } catch {
      /* noop */
    }
  }, []);

  return { clearLoginAudit };
}
