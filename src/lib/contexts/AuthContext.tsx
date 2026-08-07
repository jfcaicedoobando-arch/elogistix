import { createContext, useCallback, useContext, useEffect, useMemo, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import type { AppRole } from "@/types/appRole";
import { useAuthSession } from "./auth/useAuthSession";
import { useAuthProfile, type CachedOrganization } from "./auth/useAuthProfile";
import { useLoginAudit } from "./auth/useLoginAudit";
import { signOutCurrentSession } from "@/lib/auth/signOut";
import { registrarActividad } from "@/services/bitacora/registrar";
import { fromDb } from "@/lib/supabase/cast";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncSentryUser } from "@/lib/observability/sentry/user";
import { buildAuthSnapshot, buildSentryUserContext } from "@/lib/auth/authSnapshotBuilder";

;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  orgRole: AppRole | null;
  effectiveRole: AppRole | null;
  organizationId: string | null;
  organization: CachedOrganization | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  orgRole: null,
  effectiveRole: null,
  organizationId: null,
  organization: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/**
 * Compositor delgado. Combina sesión, perfil y auditoría de login.
 * Toda la lógica vive en `contexts/auth/` para mantener responsabilidades aisladas.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, session, loading: sessionLoading, lastEvent } = useAuthSession();
  const { profile, profileLoading, reset: resetProfile, refresh: refreshProfile } = useAuthProfile(user?.id ?? null);
  const { clearLoginAudit } = useLoginAudit(user, lastEvent);

  // P-04: `loading` debe cubrir también la resolución del perfil/rol. Si sólo
  // cubriera la sesión, `ProtectedRoute` monta la app interna (sidebar + RPCs)
  // durante la ventana en que `user != null` pero `role == null`.
  const loading = sessionLoading || (!!user && profileLoading);

  // effectiveRole: orgRole para usuarios regulares, rol global para super_admin
  const effectiveRole: AppRole | null =
    profile.role === "super_admin" ? profile.role : profile.orgRole ?? profile.role;

  // Preload de rutas frecuentes en idle tras login → mejora TTI percibido al navegar
  useEffect(() => {
    if (!user || loading) return;
    type IdleWindow = {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const w = fromDb<IdleWindow>(window);
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const cb = () => {
      void import("@/features/embarques/routes/Embarques");
      void import("@/features/cotizacion/routes/Cotizaciones");
      void import("@/features/dashboard/routes/Dashboard");
      void import("@/features/cliente/routes/Clientes");
      void import("@/features/proveedor/routes/Proveedores");
      void import("@/features/facturacion/routes/Facturacion");
    };
    if (typeof w.requestIdleCallback === "function") {
      idleHandle = w.requestIdleCallback(cb);
    } else {
      timeoutHandle = setTimeout(cb, 1500);
    }
    return () => {
      if (idleHandle !== null && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, [user, loading]);


  // Snapshot global de la sesión para consumirla fuera del árbol React (errorReport).
  useEffect(() => {
    setAuthSnapshot(buildAuthSnapshot(user, profile, effectiveRole));
    syncSentryUser(buildSentryUserContext(user, profile, effectiveRole));
  }, [user, profile, effectiveRole]);

  const userId = user?.id;
  const signOut = useCallback(async () => {
    clearLoginAudit(userId);
    await registrarActividad({ modulo: "auth", accion: "Cerró sesión" });
    await signOutCurrentSession();
    resetProfile();
  }, [userId, clearLoginAudit, resetProfile]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      role: profile.role,
      orgRole: profile.orgRole,
      effectiveRole,
      organizationId: profile.organizationId,
      organization: profile.organization,
      loading,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, effectiveRole, loading, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
