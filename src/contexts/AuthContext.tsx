import { createContext, useContext, useEffect, useMemo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { AppRole } from "@/types/appRole";
import { useAuthSession } from "./auth/useAuthSession";
import { useAuthProfile, type CachedOrganization } from "./auth/useAuthProfile";
import { useLoginAudit } from "./auth/useLoginAudit";
import { fromDb } from "@/lib/supabase/cast";
import { setAuthSnapshot } from "@/lib/ui/authSnapshot";

export type { CachedOrganization } from "./auth/useAuthProfile";

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
});

export const useAuth = () => useContext(AuthContext);

/**
 * Compositor delgado. Combina sesión, perfil y auditoría de login.
 * Toda la lógica vive en `contexts/auth/` para mantener responsabilidades aisladas.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, session, loading, lastEvent } = useAuthSession();
  const { profile, reset: resetProfile } = useAuthProfile(user?.id ?? null);
  const { clearLoginAudit } = useLoginAudit(user, lastEvent);

  // effectiveRole: orgRole para usuarios regulares, rol global para super_admin
  const effectiveRole: AppRole | null =
    profile.role === "super_admin" ? profile.role : profile.orgRole ?? profile.role;

  // Preload de rutas frecuentes en idle tras login → mejora TTI percibido al navegar
  useEffect(() => {
    if (!user || loading) return;
    type IdleWindow = { requestIdleCallback?: (cb: () => void) => number };
    const idle = (cb: () => void) => {
      const w = fromDb<IdleWindow>(window);
      if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(cb);
      else setTimeout(cb, 1500);
    };
    idle(() => {
      void import("@/pages/embarques/Embarques");
      void import("@/pages/cotizaciones/Cotizaciones");
      void import("@/pages/dashboard/Dashboard");
      void import("@/pages/clientes/Clientes");
      void import("@/pages/proveedores/Proveedores");
      void import("@/pages/facturacion/Facturacion");
    });
  }, [user, loading]);

  // Snapshot global de la sesión para consumirla fuera del árbol React (errorReport).
  useEffect(() => {
    setAuthSnapshot({
      userId: user?.id ?? null,
      email: user?.email ?? null,
      organizationId: profile.organizationId ?? null,
      organizationName: profile.organization?.nombre ?? null,
      role: profile.role ?? null,
      effectiveRole: effectiveRole ?? null,
    });
    // Sincronizar el contexto de usuario en Sentry para que los reportes
    // de feedback y errores lleguen etiquetados por org + rol.
    syncSentryUser({
      userId: user?.id ?? null,
      email: user?.email ?? null,
      organizationId: profile.organizationId ?? null,
      effectiveRole: effectiveRole ?? null,
    });
  }, [user, profile.organizationId, profile.organization, profile.role, effectiveRole]);

  const signOut = async () => {
    clearLoginAudit(user?.id);
    await supabase.auth.signOut();
    resetProfile();
  };

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
    }),
    // signOut es estable en términos prácticos (closures dependen de user que ya está en deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, session, profile, effectiveRole, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
