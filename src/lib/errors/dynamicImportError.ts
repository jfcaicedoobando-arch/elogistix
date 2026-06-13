/**
 * Detección de errores transitorios de carga de chunks dinámicos (Vite / React.lazy).
 *
 * Estos errores aparecen cuando una pestaña tiene cacheado un bundle viejo y
 * el servidor ya sirvió uno nuevo con otro hash. La app se auto-recupera con
 * un reload, así que se filtran de Sentry y se manejan globalmente.
 */
import {
  hasChunkReloadBeenAttempted,
  markChunkReloadAttempted,
} from "@/lib/browserStorage";

const SIGNATURES = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "error loading dynamically imported module",
  "dynamically imported module",
  "loading chunk",
  "chunkloaderror",
  // React.lazy resuelve con módulo "vacío" cuando el chunk servido es de un
  // deploy anterior y no contiene el `default` export esperado. La firma
  // exacta es `Cannot read properties of undefined (reading 'default')`.
  "reading 'default'",
  "reading \"default\"",
];

export function isDynamicImportErrorMessage(message: string | undefined | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return SIGNATURES.some((sig) => lower.includes(sig));
}

export function isDynamicImportError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error) return isDynamicImportErrorMessage(error.message);
  if (typeof error === "string") return isDynamicImportErrorMessage(error);
  if (typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    return typeof msg === "string" && isDynamicImportErrorMessage(msg);
  }
  return false;
}

/** Recarga una sola vez por sesión. Devuelve true si disparó reload. */
export function tryReloadForChunkError(reloadPage?: () => void): boolean {
  if (typeof window === "undefined") return false;
  if (hasChunkReloadBeenAttempted()) return false;
  markChunkReloadAttempted();
  (reloadPage ?? (() => window.location.reload()))();
  return true;
}
