/**
 * Contexto estrecho para el `Session` volátil (paso 11 de la auditoría).
 *
 * El `access_token` rota en cada TOKEN_REFRESHED (~cada hora) y ese cambio no
 * le interesa a los ~100 consumidores de `useAuth`: sólo quien arma llamadas
 * autenticadas (p. ej. badges del sidebar) necesita el token. Separarlo evita
 * re-renderizar toda la app en cada rotación.
 *
 * La suscripción a Supabase sigue siendo única: `AuthProvider` llama una sola
 * vez a `useAuthSession` y publica aquí el `Session` ya resuelto. Este hook
 * NUNCA debe invocar `useAuthSession` por su cuenta.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

const AuthSessionContext = createContext<Session | null>(null);

/** Sólo lo usa `AuthProvider`; no montar proveedores adicionales. */
export function AuthSessionProvider({
  session,
  children,
}: {
  session: Session | null;
  children: ReactNode;
}) {
  return (
    <AuthSessionContext.Provider value={session}>
      {children}
    </AuthSessionContext.Provider>
  );
}

/**
 * Devuelve el `Session` vigente (o null). Usarlo sólo cuando se necesita el
 * `access_token`; para user/roles/organización seguir con `useAuth`.
 */
export const useAuthSessionToken = (): Session | null =>
  useContext(AuthSessionContext);
