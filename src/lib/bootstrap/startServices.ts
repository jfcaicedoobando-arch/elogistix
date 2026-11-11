/**
 * Arranque de servicios auxiliares fuera del critical path.
 *
 * Sentry y el persister esperan un turno ocioso. Si el primer render falla,
 * la captura de errores puede cargar Sentry de inmediato por la misma promesa.
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

/** Devuelve la finalización del intento de arranque de Sentry. */
export function startServices(client: QueryClient, deps: StartServicesDeps = {}): Promise<void> {
  const loadPersister = deps.loadPersister ?? (() => import("@/lib/query/persistBootstrap"));
  const schedule = deps.schedule ?? scheduleIdle;

  const loadSentry = async () => {
    if (deps.loadSentry) (await deps.loadSentry()).initSentry();
    else await loadInitializedSentry();
  };

  return new Promise((resolve) => {
    schedule(() => {
      void loadSentry().then(() => resolve(), () => resolve());
      void Promise.resolve().then(loadPersister)
        .then((m) => m.bootstrapQueryPersister(client))
        .catch(() => undefined);
    });
  });
}
