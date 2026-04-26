import { createContext, useContext, useEffect, useState, useRef, useMemo, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { AppRole } from "@/types/appRole";

export interface CachedOrganization {
  id: string;
  nombre: string;
  rfc: string | null;
  logo_url: string | null;
  plan: string | null;
  activo: boolean | null;
}

interface UserContext {
  role: AppRole | null;
  orgRole: AppRole | null;
  organizationId: string | null;
  organization: CachedOrganization | null;
}

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

// Cache TTL — avoid re-fetching context within this window
const CONTEXT_TTL_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ctx, setCtx] = useState<UserContext>({ role: null, orgRole: null, organizationId: null, organization: null });
  const [loading, setLoading] = useState(true);
  const hasLoggedLogin = useRef(false);
  const lastFetchedFor = useRef<string | null>(null);
  const lastFetchedAt = useRef<number>(0);
  const inflight = useRef<Promise<void> | null>(null);

  const fetchUserContext = useCallback(async (userId: string) => {
    const now = Date.now();
    if (lastFetchedFor.current === userId && now - lastFetchedAt.current < CONTEXT_TTL_MS) {
      return; // Skip — cache fresh
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
        setCtx({
          role: (payload.role as AppRole) ?? null,
          orgRole: (payload.orgRole as AppRole) ?? null,
          organizationId: payload.organizationId ?? null,
          organization: payload.organization ?? null,
        });
        lastFetchedFor.current = userId;
        lastFetchedAt.current = Date.now();
      } catch {
        // silent — keep previous context
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = promise;
    return promise;
  }, []);

  const registrarLogin = useCallback(async (userId: string, email: string) => {
    try {
      await supabase.from('bitacora_actividad').insert([{
        usuario_id: userId,
        usuario_email: email,
        accion: 'login',
        modulo: 'auth',
        entidad_nombre: email,
      }]);
    } catch {
      // No bloquear login si falla el registro
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST.
    // IMPORTANT: ignoramos TOKEN_REFRESHED e INITIAL_SESSION para evitar
    // re-renders y refetches en cascada cada ~60s cuando Supabase rota el token.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (eventoAuth, newSession) => {
        if (eventoAuth === 'TOKEN_REFRESHED' || eventoAuth === 'INITIAL_SESSION') {
          // Solo actualizamos la session silenciosamente si cambió la referencia,
          // sin tocar user ni disparar fetchs. Esto evita invalidar React Query.
          setSession((prev) => (prev?.access_token === newSession?.access_token ? prev : newSession));
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          // Defer to avoid potential deadlock with Supabase client
          setTimeout(() => fetchUserContext(newSession.user.id), 0);
          if (eventoAuth === 'SIGNED_IN' && !hasLoggedLogin.current) {
            // Guard adicional por sessionStorage para no re-loguear en refresh de pestaña
            const loginKey = `lc:login-logged:${newSession.user.id}`;
            if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(loginKey)) {
              hasLoggedLogin.current = true;
            } else {
              hasLoggedLogin.current = true;
              try { sessionStorage?.setItem(loginKey, '1'); } catch { /* noop */ }
              setTimeout(() => registrarLogin(newSession.user.id, newSession.user.email ?? ''), 100);
            }
          }
        } else {
          setCtx({ role: null, orgRole: null, organizationId: null, organization: null });
          lastFetchedFor.current = null;
          lastFetchedAt.current = 0;
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        fetchUserContext(existing.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserContext, registrarLogin]);

  const signOut = async () => {
    hasLoggedLogin.current = false;
    lastFetchedFor.current = null;
    lastFetchedAt.current = 0;
    try {
      if (typeof sessionStorage !== 'undefined' && user?.id) {
        sessionStorage.removeItem(`lc:login-logged:${user.id}`);
      }
    } catch { /* noop */ }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setCtx({ role: null, orgRole: null, organizationId: null, organization: null });
  };

  // effectiveRole: orgRole for regular users, global role for super_admin
  const effectiveRole: AppRole | null = ctx.role === 'super_admin' ? ctx.role : (ctx.orgRole ?? ctx.role);

  // Preload de rutas frecuentes en idle tras login — mejora TTI percibido al navegar
  useEffect(() => {
    if (!user || loading) return;
    const idle = (cb: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
      if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(cb);
      else setTimeout(cb, 1500);
    };
    idle(() => {
      void import("@/pages/Embarques");
      void import("@/pages/Cotizaciones");
      void import("@/pages/Dashboard");
    });
  }, [user, loading]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    role: ctx.role,
    orgRole: ctx.orgRole,
    effectiveRole,
    organizationId: ctx.organizationId,
    organization: ctx.organization,
    loading,
    signOut,
  }), [user, session, ctx, effectiveRole, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
