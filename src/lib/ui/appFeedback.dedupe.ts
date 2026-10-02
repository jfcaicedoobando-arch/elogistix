import { safeReportJson } from "@/lib/diagnostics/safeReportValue";
import type { ErrorNotifyOptions } from "./appFeedback.types";

/**
 * Deduplicado de toasts: evita que el mismo mensaje (mismo tipo + título +
 * descripción) aparezca dos veces en una ventana corta — p. ej. cuando un
 * `useEffect` se dispara dos veces en StrictMode o un doble clic dispara la
 * misma mutación fallida dos veces seguidas.
 */

/** Ventana dentro de la cual un toast idéntico se considera duplicado. */
export const TOAST_DEDUPE_WINDOW_MS = 4000;

const lastShownAt = new Map<string, number>();

/** Clave estable de contenido para deduplicar (no incluye IDs generados). */
export function computeToastDedupeKey(
  kind: string,
  title: string,
  description?: string,
  identity?: string,
): string {
  return `${kind}|${title}|${description ?? ""}|${identity ?? ""}`;
}

export function errorToastIdentity(opts: ErrorNotifyOptions, title: string): string {
  const base = opts.method ?? opts.phase ?? opts.errorCode ?? title;
  const suffix = opts.requestId ?? (opts.context ? safeReportJson(opts.context) : "");
  return `err-${base}-${identityHash(suffix)}`;
}

function identityHash(value: string): string {
  let hash = 5381;
  for (const character of value) hash = (hash * 33) ^ character.charCodeAt(0);
  return (hash >>> 0).toString(36);
}

/**
 * ¿Debe suprimirse este toast por ser un duplicado reciente? Si no se
 * suprime, registra el timestamp para futuras comparaciones.
 */
export function shouldSuppressDuplicateToast(key: string, now: number = Date.now()): boolean {
  const prev = lastShownAt.get(key);
  if (prev !== undefined && now - prev < TOAST_DEDUPE_WINDOW_MS) {
    return true;
  }
  lastShownAt.set(key, now);
  if (lastShownAt.size > 256) {
    const oldest = lastShownAt.keys().next().value;
    if (oldest !== undefined) lastShownAt.delete(oldest);
  }
  return false;
}

/** Sólo para pruebas: limpia el estado de deduplicado entre casos. */
export function resetToastDedupeState() {
  lastShownAt.clear();
}
