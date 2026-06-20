import { useCallback, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { safeSessionStorage, loginLoggedKey } from "@/lib/browserStorage";
import { insertLoginAudit } from "@/features/auth/services";

/**
 * Registra la actividad de login en bitácora una sola vez por sesión por usuario,
 * con guarda en sessionStorage para evitar re-loguear en refresh de pestaña.
 */
export function useLoginAudit(
  user: User | null,
  lastEvent: "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | null,
) {
  const hasLoggedLogin = useRef(false);

  useEffect(() => {
    if (lastEvent !== "SIGNED_IN" || !user || hasLoggedLogin.current) return;
    const key = loginLoggedKey(user.id);
    if (safeSessionStorage.getItem(key)) {
      hasLoggedLogin.current = true;
      return;
    }
    hasLoggedLogin.current = true;
    safeSessionStorage.setItem(key, "1");
    const t = setTimeout(() => insertLoginAudit(user.id, user.email ?? ""), 100);
    return () => clearTimeout(t);
  }, [lastEvent, user]);

  const clearLoginAudit = useCallback((userId: string | undefined) => {
    hasLoggedLogin.current = false;
    if (!userId) return;
    safeSessionStorage.removeItem(loginLoggedKey(userId));
  }, []);

  return { clearLoginAudit };
}
