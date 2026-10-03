/**
 * Arranque de servicios auxiliares fuera del critical path.
 *
 * La configuración e integraciones de Sentry se cargan INMEDIATAMENTE por
 * import dinámico. El adaptador de rutas sí se importa estáticamente para
 * conservar el estado React. La promesa compartida permite encolar
 * capturas del primer render hasta que el SDK esté listo. El persister de
 * TanStack Query sí espera al idle porque hidratar el cache no es crítico.
 */
import type { QueryClient } from "@tanstack/react-query";
import { loadInitializedSentry } from "@/lib/observability/sentry/runtime";

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
export function startServices(client: QueryClient, deps: StartServicesDeps = {}): Promise<void> {
  const loadPersister = deps.loadPersister ?? (() => import("@/lib/query/persistBootstrap"));
  const schedule = deps.schedule ?? scheduleIdle;

  const sentryPromise = deps.loadSentry
    ? deps.loadSentry().then((m) => m.initSentry()).catch(() => undefined)
    : loadInitializedSentry().then(() => undefined);
  // Attach rejection handling now, not after the idle callback.
  const persisterPromise = loadPersister().catch(() => null);

  schedule(() => {
    void Promise.resolve(persisterPromise)
      .then((m) => m?.bootstrapQueryPersister(client))
      .catch(() => undefined);
  });
  return sentryPromise;
}
