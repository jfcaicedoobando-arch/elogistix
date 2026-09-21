/**
 * Arranque de servicios auxiliares fuera del critical path.
 *
 * Sentry se ejecuta INMEDIATAMENTE (el módulo se carga por import dinámico,
 * así que no entra al bundle inicial, pero no se retrasa su ejecución: así no
 * hay ventana ciega para los crashes del primer render). El persister de
 * TanStack Query sí espera al idle porque hidratar el cache no es crítico.
 */
import type { QueryClient } from "@tanstack/react-query";

const IDLE_TIMEOUT_MS = 1500;
const FALLBACK_DELAY_MS = 200;

/** `requestIdleCallback` cuando existe; si no, `setTimeout` de 200 ms. */
export function scheduleIdle(cb: () => void): void {
  const w = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(() => cb(), { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(cb, FALLBACK_DELAY_MS);
  }
}

export interface StartServicesDeps {
  loadSentry?: () => Promise<{ initSentry: () => void }>;
  loadPersister?: () => Promise<{
    bootstrapQueryPersister: (client: QueryClient) => Promise<void> | void;
  }>;
  schedule?: (cb: () => void) => void;
}

/** Inicia Sentry (inmediato) y el persister (diferido al idle). */
export function startServices(client: QueryClient, deps: StartServicesDeps = {}): void {
  const loadSentry = deps.loadSentry ?? (() => import("@/lib/observability/sentry/core"));
  const loadPersister = deps.loadPersister ?? (() => import("@/lib/query/persistBootstrap"));
  const schedule = deps.schedule ?? scheduleIdle;

  const sentryPromise = loadSentry();
  const persisterPromise = loadPersister();

  void sentryPromise.then((m) => m.initSentry()).catch(() => undefined);

  schedule(() => {
    void Promise.resolve(persisterPromise)
      .then((m) => m.bootstrapQueryPersister(client))
      .catch(() => undefined);
  });
}
