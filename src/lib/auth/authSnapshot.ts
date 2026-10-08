/**
 * Snapshot global mutable de la sesión actual (usuario, organización, rol).
 * Lo escribe `AuthProvider` en cada render para que utilidades fuera del
 * árbol React (helpers de logging, builders de error, etc.) puedan leer
 * el contexto sin necesidad de hooks. Sólo lectura desde el resto del código.
 */

import { resetSessionCaches } from "./sessionCacheRegistry";
import { clearErrorReports } from "@/lib/diagnostics/errorDetailsStore";

export interface AuthSnapshot {
  userId: string | null;
  email: string | null;
  organizationId: string | null;
  organizationName: string | null;
  role: string | null;
  effectiveRole: string | null;
}

let current: AuthSnapshot = {
  userId: null,
  email: null,
  organizationId: null,
  organizationName: null,
  role: null,
  effectiveRole: null,
};

export function setAuthSnapshot(next: AuthSnapshot): void {
  if (next.userId !== current.userId || next.organizationId !== current.organizationId
    || next.effectiveRole !== current.effectiveRole) {
    resetSessionCaches();
    clearErrorReports();
  }
  current = next;
}

export function getAuthSnapshot(): AuthSnapshot {
  return current;
}

let sessionIdentity: { userId: string; sessionId: string } | null = null;

/** Runs synchronously in the auth listener, before any React update. */
export function syncAuthSessionUser(userId: string | null, sessionId?: string | null): void {
  const previous = sessionIdentity;
  if (!userId) sessionIdentity = null;
  else if (sessionId) sessionIdentity = { userId, sessionId };
  if (userId === current.userId) {
    // SIGNED_IN also fires on tab focus. Revoke only a demonstrably new session.
    if (sessionId && previous?.userId === userId && previous.sessionId !== sessionId) {
      resetSessionCaches();
    }
    return;
  }
  resetSessionCaches();
  setAuthSnapshot({ userId, email: null, organizationId: null,
    organizationName: null, role: null, effectiveRole: null });
}
