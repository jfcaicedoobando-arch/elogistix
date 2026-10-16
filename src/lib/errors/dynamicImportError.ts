/**
 * Detección de errores transitorios de carga de chunks dinámicos (Vite / React.lazy).
 *
 * Pueden aparecer cuando una pestaña conserva un bundle viejo, por un fallo
 * de red u otras causas de carga. Durante una recuperación pendiente se
 * marcan temporalmente como esperados; los fallos persistentes se reportan.
 *
 * Recuperación con guarda anti-bucle: se permiten hasta MAX_RELOADS recargas
 * automáticas dentro de RELOAD_WINDOW_MS; si el error persiste, se muestra el
 * fallback de arranque con botón "Recargar" manual en lugar de seguir
 * recargando en automático. Antes de cada recarga se muestra un overlay
 * breve ("Actualizando…") para que el usuario entienda el parpadeo.
 */
import { reserveChunkReloadAttempt } from "@/lib/browserStorage";
import { showChunkRecoveryFallback } from "./showChunkRecoveryFallback";

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

const RELOAD_WINDOW_MS = 2 * 60 * 1000;
const MAX_RELOADS = 2;
const RELOAD_DELAY_MS = 1_000;
const OVERLAY_ID = "chunk-reload-overlay";

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

export interface ChunkReloadOptions {
  error?: unknown;
  now?: () => number;
  delayMs?: number;
  showOverlay?: () => void;
  showFallback?: () => void;
}

let reloadPending = false;
const pendingErrors = new Map<Error, PropertyDescriptor | undefined>();

function isExplicitlyUnexpected(error: unknown): boolean {
  const intent = error as { expected?: unknown; cause?: { expected?: unknown } } | undefined;
  return intent?.expected === false || intent?.cause?.expected === false;
}

function markPendingError(error: unknown): void {
  if (!(error instanceof Error) || pendingErrors.has(error)) return;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "expected");
    Object.assign(error, { expected: true });
    pendingErrors.set(error, descriptor);
  } catch { /* Un error congelado sigue siendo recuperable. */ }
}

function clearPendingRecovery(): void {
  reloadPending = false;
  document.getElementById(OVERLAY_ID)?.remove();
  for (const [error, descriptor] of pendingErrors) {
    try {
      if (descriptor) Object.defineProperty(error, "expected", descriptor);
      else delete (error as Error & { expected?: boolean }).expected;
    } catch { /* No bloquear la navegación por un error congelado después. */ }
  }
  pendingErrors.clear();
}

/** Overlay mínimo (DOM plano, tokens semánticos) previo a la recarga. */
function showUpdatingOverlay(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(OVERLAY_ID)) return;
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className =
    "fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-6 text-foreground";
  const card = document.createElement("div");
  card.className =
    "rounded-lg border border-border bg-card px-6 py-4 text-center shadow-xs";
  const msg = document.createElement("p");
  msg.className = "text-sm font-medium";
  msg.textContent = "Hay una versión nueva disponible. Actualizando…";
  card.append(msg);
  overlay.append(card);
  document.body.append(overlay);
}


/**
 * Recarga ante chunk caducado. Máximo MAX_RELOADS recargas automáticas en
 * RELOAD_WINDOW_MS; al exceder el límite muestra un fallback con botón
 * "Recargar" manual. Devuelve true si una recarga está pendiente (propia o compartida).
 */
export function tryReloadForChunkError(
  reloadPage?: () => void,
  options: ChunkReloadOptions = {},
): boolean {
  if (typeof window === "undefined") return false;
  if (isExplicitlyUnexpected(options.error)) return false;
  if (reloadPending) {
    markPendingError(options.error);
    return true;
  }
  const now = (options.now ?? Date.now)();
  if (!reserveChunkReloadAttempt(now, MAX_RELOADS, RELOAD_WINDOW_MS)) {
    clearPendingRecovery();
    (options.showFallback ?? showChunkRecoveryFallback)();
    return false;
  }
  reloadPending = true;
  markPendingError(options.error);
  try {
    (options.showOverlay ?? showUpdatingOverlay)();
    const reload = reloadPage ?? (() => window.location.reload());
    window.setTimeout(() => {
      // beforeunload puede cancelar la navegación: no dejar un overlay ni
      // errores silenciados en el documento que conserva el formulario.
      clearPendingRecovery();
      reload();
    }, options.delayMs ?? RELOAD_DELAY_MS);
    return true;
  } catch {
    clearPendingRecovery();
    (options.showFallback ?? showChunkRecoveryFallback)();
    return false;
  }
}
