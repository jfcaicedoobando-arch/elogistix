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
  recover?: () => void;
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
  const recuperar = deps.recover ?? (() => void tryReloadForChunkError());

  target.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    recuperar();
  });

  target.addEventListener("unhandledrejection", (event) => {
    if (!esChunk(event.reason)) return;
    event.preventDefault();
    recuperar();
  });

  target.addEventListener("error", (event) => {
    if (!esChunk(event.error ?? event.message)) return;
    event.preventDefault();
    recuperar();
  });
}
