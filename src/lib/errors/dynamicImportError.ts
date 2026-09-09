/**
 * Detección de errores transitorios de carga de chunks dinámicos (Vite / React.lazy).
 *
 * Estos errores aparecen cuando una pestaña tiene cacheado un bundle viejo y
 * el servidor ya sirvió uno nuevo con otro hash. La app se auto-recupera con
 * un reload, así que se filtran de Sentry y se manejan globalmente.
 *
 * Recuperación con guarda anti-bucle: se permiten hasta MAX_RELOADS recargas
 * automáticas dentro de RELOAD_WINDOW_MS; si el error persiste, se muestra el
 * fallback de arranque con botón "Recargar" manual en lugar de seguir
 * recargando en automático. Antes de cada recarga se muestra un overlay
 * breve ("Actualizando…") para que el usuario entienda el parpadeo.
 */
import {
  getChunkReloadHistory,
  saveChunkReloadHistory,
} from "@/lib/browserStorage";
import { renderBootstrapFallback } from "@/lib/bootstrap/renderBootstrapFallback";

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
  now?: () => number;
  delayMs?: number;
  showOverlay?: () => void;
  showFallback?: () => void;
}

/** Registra el intento y devuelve cuántos van dentro de la ventana activa. */
function registerAttempt(now: number): number {
  const prev = getChunkReloadHistory();
  const dentroDeVentana = prev !== null && now - prev.first < RELOAD_WINDOW_MS;
  const next = dentroDeVentana
    ? { count: prev.count + 1, first: prev.first }
    : { count: 1, first: now };
  saveChunkReloadHistory(next);
  return next.count;
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
    "rounded-lg border border-border bg-card px-6 py-4 text-center shadow-sm";
  const msg = document.createElement("p");
  msg.className = "text-sm font-medium";
  msg.textContent = "Hay una versión nueva disponible. Actualizando…";
  card.append(msg);
  overlay.append(card);
  document.body.append(overlay);
}

function showManualFallback(): void {
  renderBootstrapFallback(
    new Error(
      "No pudimos cargar la versión más reciente de la aplicación. Usa el botón Recargar para intentarlo de nuevo.",
    ),
  );
}

/**
 * Recarga ante chunk caducado. Máximo MAX_RELOADS recargas automáticas en
 * RELOAD_WINDOW_MS; al exceder el límite muestra un fallback con botón
 * "Recargar" manual. Devuelve true si programó una recarga.
 */
export function tryReloadForChunkError(
  reloadPage?: () => void,
  options: ChunkReloadOptions = {},
): boolean {
  if (typeof window === "undefined") return false;
  const now = (options.now ?? Date.now)();
  const intentos = registerAttempt(now);
  if (intentos > MAX_RELOADS) {
    (options.showFallback ?? showManualFallback)();
    return false;
  }
  (options.showOverlay ?? showUpdatingOverlay)();
  const reload = reloadPage ?? (() => window.location.reload());
  window.setTimeout(reload, options.delayMs ?? RELOAD_DELAY_MS);
  return true;
}
