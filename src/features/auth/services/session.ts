import { readAuthSessionIdentity } from "@/lib/auth/authSessionIdentity";
import { invalidateSessionCacheEntries } from "@/lib/auth/sessionCacheRegistry";
/**
 * Servicio Auth — sesión y listener. Aísla la I/O a `supabase.auth` para que
 * los contexts/hooks no toquen el cliente Supabase directamente.
 */
import { syncAuthSessionUser } from "@/lib/auth/authSnapshot";
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { Session, AuthChangeEvent, Subscription } from "@supabase/supabase-js";
import type { AppRole } from "@/types/appRole";

export type AuthSubscription = Subscription;

export function subscribeToAuthChanges(
  cb: (event: AuthChangeEvent, session: Session | null) => void,
): AuthSubscription {
  let active = true;
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (!active) return;
    const identity = readAuthSessionIdentity(session?.access_token);
    syncAuthSessionUser(session?.user.id ?? null, identity);
    // Older/custom auth payloads without identity can still discard short-lived
    // data, but cannot prove a new session and must not revoke a confirmation.
    if (event === "SIGNED_IN" && !identity) invalidateSessionCacheEntries();
    cb(event, session);
  });
  return { ...subscription, unsubscribe: () => { active = false; subscription.unsubscribe(); } };
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

import { signOutCurrentSession as signOutSesionBase } from "@/lib/auth/signOut";

/**
 * Cierra la sesión actual. Registra la bitácora ANTES de invocar
 * `supabase.auth.signOut()` para que exista un usuario autenticado
 * al momento de escribir el registro.
 */
export async function signOutCurrentSession(): Promise<void> {
  await registrarActividad({ modulo: "auth", accion: "Cerró sesión" });
  await signOutSesionBase();
}

export interface CachedOrganization {
  id: string;
  nombre: string;
  rfc: string | null;
  logo_url: string | null;
  plan: string | null;
  activo: boolean | null;
  direccion: string | null;
  moneda_preferida: string | null;
  onboarding_completado: boolean | null;
}

export interface UserContextPayload {
  role: AppRole | null;
  orgRole: AppRole | null;
  organizationId: string | null;
  organization: CachedOrganization | null;
}

/**
 * Llama al RPC `get_user_context` y normaliza el payload a tipos del dominio.
 * No lanza: devuelve `null` para que el caller decida mantener el perfil previo.
 */
export async function fetchUserContext(): Promise<UserContextPayload | null> {
  const { data, error } = await supabase.rpc("get_user_context");
  if (error) return null;
  const payload = (data ?? {}) as {
    role?: string | null;
    orgRole?: string | null;
    organizationId?: string | null;
    organization?: CachedOrganization | null;
  };
  return {
    role: (payload.role as AppRole) ?? null,
    orgRole: (payload.orgRole as AppRole) ?? null,
    organizationId: payload.organizationId ?? null,
    organization: payload.organization ?? null,
  };
}
