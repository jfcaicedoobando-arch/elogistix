/**
 * Store en memoria con el contexto "ambiental" que enriquece TODO evento
 * reportado a Sentry vía `reportCaughtError`. Se hidrata una sola vez desde
 * `useSyncSentryErrorContext` y se lee de forma síncrona en el call site del
 * error, así no dependemos de que cada caller pase organizationId/route.
 *
 * 13.141.8 — cierre de gap "qué tenant produjo este error" en Sentry.
 */
import { APP_VERSION } from "@/constants/appVersion";

export interface ErrorContextSnapshot {
  organizationId: string | null;
  organizationName: string | null;
  effectiveRole: string | null;
  userId: string | null;
  userEmail: string | null;
  route: string | null;
  appVersion: string;
}

const state: ErrorContextSnapshot = {
  organizationId: null,
  organizationName: null,
  effectiveRole: null,
  userId: null,
  userEmail: null,
  route: null,
  appVersion: APP_VERSION,
};

export function setErrorContext(patch: Partial<ErrorContextSnapshot>): void {
  Object.assign(state, patch);
}

export function getErrorContext(): ErrorContextSnapshot {
  return { ...state };
}

/** Sólo para tests: reset completo entre escenarios. */
export function __resetErrorContextForTests(): void {
  state.organizationId = null;
  state.organizationName = null;
  state.effectiveRole = null;
  state.userId = null;
  state.userEmail = null;
  state.route = null;
  state.appVersion = APP_VERSION;
}
