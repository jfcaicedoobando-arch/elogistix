import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notifyWarning } from "@/lib/ui/appFeedback";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import type { User } from "@supabase/supabase-js";

import type { AppRole } from "@/types/appRole";
import { useAuthSession } from "./auth/useAuthSession";
import { useAuthProfile, type CachedOrganization } from "./auth/useAuthProfile";
import { useLoginAudit } from "./auth/useLoginAudit";
import { AuthSessionProvider } from "./auth/AuthSessionContext";
import { signOutCurrentSession } from "@/lib/auth/signOut";
import { purgeSessionCache, debePurgarPorCambioDeUsuario } from "@/lib/auth/purgeSessionCache";
import { clearAllDrafts, clearAllEmbarqueDrafts } from "@/lib/auth/clearSessionDrafts";
import { clearPersistedQueryCache } from "@/lib/browserStorage";
import { getSessionCacheGeneration, subscribeSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";
import { removeStaleCatalogQueries } from "@/lib/query/catalogScope";

import { registrarActividad } from "@/services/bitacora";
import { fromDb } from "@/lib/supabase/cast";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncSentryUser } from "@/lib/observability/sentry/user";
import { buildAuthSnapshot, buildSentryUserContext } from "@/lib/auth/authSnapshotBuilder";

;

// Paso 11: `session` vive fuera de este contexto (ver auth/AuthSessionContext).
// Su `access_token` rota en cada TOKEN_REFRESHED y re-renderizaría a todos los
// consumidores; quien necesita el token usa `useAuthSessionToken`.
interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  orgRole: AppRole | null;
  effectiveRole: AppRole | null;
  organizationId: string | null;
  organization: CachedOrganization | null;
  loading: boolean;
  /** Falla técnica al cargar perfil/rol (M9). Ver `resolveSinAccesoVariant`. */
  profileError: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  orgRole: null,
  effectiveRole: null,
  organizationId: null,
  organization: null,
  loading: true,
  profileError: false,
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
  const { profile, profileLoading, profileError, reset: resetProfile, refresh: refreshProfile } = useAuthProfile(user?.id ?? null);
  const { clearLoginAudit } = useLoginAudit(user, lastEvent);

  // P-04: `loading` debe cubrir también la resolución del perfil/rol. Si sólo
  // cubriera la sesión, `ProtectedRoute` monta la app interna (sidebar + RPCs)
  // durante la ventana en que `user != null` pero `role == null`.
  const loading = sessionLoading || (!!user && profileLoading);

  // effectiveRole: orgRole para usuarios regulares, rol global para super_admin.
  // M1 — `super_admin` es un rol de plataforma: nunca puede otorgarse desde
  // `organization_members`, así que se ignora si aparece como orgRole.
  const orgRoleSeguro: AppRole | null =
    profile.orgRole === "super_admin" ? null : profile.orgRole ?? null;
  const effectiveRole: AppRole | null =
    profile.role === "super_admin" ? profile.role : orgRoleSeguro ?? profile.role;

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
  setAuthSnapshot(buildAuthSnapshot(user, profile, loading ? null : effectiveRole));
  useEffect(() => {
    syncSentryUser(buildSentryUserContext(user, profile, effectiveRole));
  }, [user, profile, effectiveRole]);

  // EC-01: purga del caché de dominio cuando entra un usuario distinto sin
  // que haya habido `signOut` explícito (pestaña compartida).
  const queryClient = useQueryClient();
  const generation = useSyncExternalStore(
    subscribeSessionCacheGeneration, getSessionCacheGeneration, getSessionCacheGeneration,
  );
  // También purga logout externo/cambio de rol sin consumidores montados.
  useEffect(() => removeStaleCatalogQueries(queryClient, generation), [queryClient, generation]);
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (debePurgarPorCambioDeUsuario(lastEvent, prevUserIdRef.current, currentUserId)) {
      purgeSessionCache(queryClient);
    }
    prevUserIdRef.current = currentUserId;
  }, [user, lastEvent, queryClient]);

  const userId = user?.id;
  const signOut = useCallback(async () => {
    // La bitácora no debe bloquear la salida si el servidor está inaccesible.
    void registrarActividad({ modulo: "auth", accion: "Solicitó cerrar sesión",
      authScope: captureAuthOperationScope(),
    }).catch(() => { /* La bitácora no bloquea la salida. */ });
    const result = await signOutCurrentSession();
    clearLoginAudit(userId);
    resetProfile();
    // EC-01: no dejar datos del tenant saliente para el siguiente usuario.
    purgeSessionCache(queryClient);
    // Sin import() ni red: los borradores privados se limpian también offline.
    clearAllDrafts();
    clearAllEmbarqueDrafts();
    // La copia persistida del query cache (lc-query-cache-v1) tampoco queda.
    clearPersistedQueryCache();
    if (result && !result.globalRequestSucceeded) {
      notifyWarning(undefined, { title: "Sesión cerrada en este dispositivo", description: "No se pudo confirmar el cierre en otros dispositivos." });
    }
  }, [userId, clearLoginAudit, resetProfile, queryClient]);


  const value = useMemo<AuthContextType>(
    () => ({
      user,
      role: profile.role,
      orgRole: profile.orgRole,
      effectiveRole,
      organizationId: profile.organizationId,
      organization: profile.organization,
      loading,
      profileError,
      signOut,
      refreshProfile,
    }),
    [user, profile, effectiveRole, loading, profileError, signOut, refreshProfile],
  );

  // El `Session` (token volátil) se publica en un contexto separado para que
  // su rotación no invalide el `value` de arriba. La suscripción a Supabase
  // sigue siendo única: es el mismo `session` de `useAuthSession`.
  return (
    <AuthSessionProvider session={session}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </AuthSessionProvider>
  );
}
