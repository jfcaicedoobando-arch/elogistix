/**
 * Tareas de arranque previas al montaje de React.
 *
 * Extraídas de `main.tsx` (paso 12 de la auditoría) para poder probarlas sin
 * importar el punto de entrada ni ejecutar sus efectos globales. El
 * comportamiento es idéntico al que vivía inline: mismas condiciones, mismos
 * listeners y mismo `preventDefault`.
 */
import { APP_VERSION } from "@/constants/appVersion";
import {
  clearPersistedQueryCache,
  getStoredAppVersion,
  setStoredAppVersion,
} from "@/lib/browserStorage";
import {
  isDynamicImportError,
  tryReloadForChunkError,
} from "@/lib/errors/dynamicImportError";
import { queryClient } from "@/lib/query/queryClient";

export interface VersionSyncDeps {
  version?: string;
  getStoredVersion?: () => string | null;
  setStoredVersion?: (version: string) => void;
  clearMemoryCache?: () => void;
  clearPersistedCache?: () => void;
}

/**
 * Invalida caches (memoria + persistencia) SÓLO cuando `APP_VERSION` cambió
 * respecto a la versión guardada. Devuelve `true` si hubo limpieza.
 */
export function syncAppVersion(deps: VersionSyncDeps = {}): boolean {
  const version = deps.version ?? APP_VERSION;
  const stored = (deps.getStoredVersion ?? getStoredAppVersion)();
  if (stored === version) return false;

  (deps.clearMemoryCache ?? (() => queryClient.clear()))();
  (deps.clearPersistedCache ?? clearPersistedQueryCache)();
  (deps.setStoredVersion ?? setStoredAppVersion)(version);
  return true;
}

export interface ChunkRecoveryDeps {
  target?: Pick<Window, "addEventListener">;
  isChunkError?: (error: unknown) => boolean;
  recover?: () => boolean;
}

/**
 * Registra los tres caminos por los que un chunk caducado se manifiesta:
 * `vite:preloadError` (preload de Vite), `unhandledrejection` (rechazo del
 * `import()` de React.lazy) y `error` (lanzamiento síncrono dentro del
 * reconciler). En los dos últimos sólo actúa si la firma es de chunk.
 */
export function registerChunkRecoveryListeners(deps: ChunkRecoveryDeps = {}): void {
  const target = deps.target ?? window;
  const esChunk = deps.isChunkError ?? isDynamicImportError;
  const recuperar = deps.recover ?? tryReloadForChunkError;
  const recoverError = (error: unknown): boolean => {
    const recovering = recuperar();
    if (recovering && error instanceof Error) Object.assign(error, { expected: true });
    return recovering;
  };

  // Sin preventDefault: si se previene, Vite resuelve el import() con
  // `undefined` y el código que desestructura truena (JAVASCRIPT-REACT-74).
  // Dejamos que el import() rechace con su error real y sólo recuperamos.
  target.addEventListener("vite:preloadError", (event) => {
    recoverError((event as Event & { payload?: unknown }).payload);
  });

  target.addEventListener("unhandledrejection", (event) => {
    if (!esChunk(event.reason)) return;
    if (recoverError(event.reason)) event.preventDefault();
  });

  target.addEventListener("error", (event) => {
    if (!esChunk(event.error ?? event.message)) return;
    if (recoverError(event.error ?? event.message)) event.preventDefault();
  });
}
