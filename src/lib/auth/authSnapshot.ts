/**
 * Snapshot global mutable de la sesión actual (usuario, organización, rol).
 * Lo escribe `AuthProvider` en cada render para que utilidades fuera del
 * árbol React (helpers de logging, builders de error, etc.) puedan leer
 * el contexto sin necesidad de hooks. Sólo lectura desde el resto del código.
 */

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
  current = next;
}

export function getAuthSnapshot(): AuthSnapshot {
  return current;
}
